<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page, useVbenModelDrawer } from '@vben/common-ui';

import { useClipboard } from '@vueuse/core';
import { Image, message, Upload } from 'ant-design-vue';

import {
  searchOrderVectorById,
  searchOrderVectorByUpload,
} from '#/api/erp/orderVector';
import {
  previewFileAsDataURL,
  useImagePasteUpload,
} from '#/composables/use-image-paste-upload';
import { $t } from '#/locales';
import FormView from '#/views/erp/order/modules/form-view.vue';

const { hasAccessByCodes } = useAccess();

/**
 * 左侧查询图文件（用户上传的本地 File）。
 * <p>注意：{@link queryImageUrl} 才是模板真正展示的图片 URL，
 * 它既可能来自 FileReader.readAsDataURL（用户上传），
 * 也可能来自父页面跳过来的 byId 模式（服务端 URL）。
 */
const queryFile = ref<FileType | null>(null);
const queryImageUrl = ref<string>('');
const topK = ref<number>(100);
const submitting = ref(false);

/**
 * 搜索结果。
 * <p>本页面允许两种入口：
 * <ul>
 *   <li>upload 模式：用户自己上传图搜</li>
 *   <li>byId 模式：从列表行 "按编号搜索" 跳转过来时，
 *       通过 query string (?vectorId=xxx) 携带目标图 ID，落地直接搜一次</li>
 * </ul>
 */
const results = ref<any[]>([]);
const lastQueryTime = ref<number>(0);
const sourceTag = ref<'byId' | 'upload'>('upload');

/** byId 模式下被搜的那张图的向量编号（用于标题展示） */
const currentVectorId = ref<string>('');

const hasImage = computed(() => !!queryFile.value);
const hasResults = computed(() => results.value.length > 0);

/**
 * "开始搜索"按钮可点条件：
 * <ul>
 *   <li>byId 模式：进入页面已经搜过一次了，按钮不可点（避免重复搜）。</li>
 *   <li>upload 模式：必须上传了真 File。</li>
 * </ul>
 */
const canSearch = computed(
  () => sourceTag.value === 'upload' && hasImage.value,
);

/**
 * 单张图片粘贴框：本页面只有一个查询图，所以粘贴走"替换 queryFile"
 * 逻辑；和 beforeUpload 行为一致 —— 替换 file、清结果、切回 upload 模式。
 */
const {
  pasteInputRef,
  pasteInputValue,
  focusPasteTarget,
  onPasteInputChange,
  handlePaste,
} = useImagePasteUpload({
  errorHint: $t('infra.vectorImage.upload.hint'),
  onFile: (file) => {
    queryFile.value = file;
    queryImageUrl.value = '';
    results.value = [];
    sourceTag.value = 'upload';
    previewFileAsDataURL(file, (dataUrl) => {
      queryImageUrl.value = dataUrl;
    });
  },
});

const route = useRoute();

/**
 * 进入页面时根据 query 决定是 upload 模式还是 byId 模式。
 *
 * <p>byId 模式由父页面（{@link ../index.vue} 的"按编号搜索"按钮）通过
 * {@code /erp/order-vector/search?vectorId=xxx} 跳过来，进入时立刻搜一次，
 * 把命中的图（order_vector.imageUrl）作为左侧默认展示图。
 */
async function initFromRoute() {
  const vectorId = (route.query.vectorId as string) || '';
  if (!vectorId) {
    sourceTag.value = 'upload';
    return;
  }
  sourceTag.value = 'byId';
  currentVectorId.value = vectorId;
  // 既然由 vectorId 直接搜，先行清空查询图，等结果回来再用命中的图作为预览
  queryFile.value = null;
  await runSearchById(vectorId);
}

/** 调用后端 /search?id=&topK= 接口 */
async function runSearchById(id: string) {
  submitStart();
  try {
    const data = await searchOrderImageByIdWithFallback(id, topK.value);
    results.value = Array.isArray(data) ? data : [];
    lastQueryTime.value = Date.now();
    // 把命中的第一张图（被搜的那张图）放到左侧预览。
    // byId 模式下命中的 imagePath 就是 erp_order_vector.imageUrl
    // （来自 SearchResult.imagePath）。
    queryImageUrl.value =
      results.value.length > 0 ? (results.value[0].imagePath ?? '') : '';
    if (results.value.length === 0) {
      message.info($t('erp.orderVector.message.searchNoResult'));
    }
  } catch (error: any) {
    console.error(
      $t('erp.orderVector.message.searchFailed', [
        error?.message ?? String(error),
      ]),
    );
  } finally {
    submitEnd();
  }
}

/** 调用后端 /search/upload 接口（带 multipart file） */
async function runSearchByUpload() {
  if (!queryFile.value) {
    message.warning($t('erp.orderVector.message.searchEmpty'));
    return;
  }
  submitStart();
  try {
    const data = await searchOrderVectorByUpload(
      { file: queryFile.value as File },
      topK.value,
    );
    results.value = Array.isArray(data) ? data : [];
    lastQueryTime.value = Date.now();
    if (results.value.length === 0) {
      message.info($t('erp.orderVector.search.empty'));
    }
  } catch (error: any) {
    console.error(
      $t('erp.orderVector.message.searchFailed', [
        error?.message ?? queryFile.value?.name ?? '',
      ]),
    );
  } finally {
    submitEnd();
  }
}

function submitStart() {
  submitting.value = true;
}
function submitEnd() {
  submitting.value = false;
}

/**
 * 上传前预览：把上传图切换成新的 File，URL 用 FileReader 刷新，
 * 同时清空旧结果并切回 upload 模式。
 * <p>用户从 drag 区拖了新图上来（无论之前是 upload 还是 byId 模式），
 * 都切回 upload 模式 —— 否则再次点"开始搜索"会按 byId 逻辑处理。
 */
function beforeUpload(file: FileType) {
  if (!file.type?.startsWith?.('image/')) {
    message.error($t('infra.vectorImage.upload.hint'));
    return Upload.LIST_IGNORE;
  }
  queryFile.value = file;
  queryImageUrl.value = '';
  results.value = [];
  sourceTag.value = 'upload';
  const reader = new FileReader();
  reader.addEventListener('load', (e) => {
    queryImageUrl.value = (e.target?.result as string) ?? '';
  });
  reader.readAsDataURL(file);
  return false;
}

/**
 * 清空当前查询图（无论是 byId 默认填充的还是用户上传的），
 * 顺手把 sourceTag 切回 upload，这样下次点"搜索"会走上传搜路径。
 */
function resetQuery() {
  queryFile.value = null;
  queryImageUrl.value = '';
  results.value = [];
  lastQueryTime.value = 0;
  sourceTag.value = 'upload';
  currentVectorId.value = '';
}

/**
 * "按编号查询"标题。
 * <p>upload 模式下显示文件名；byId 模式下显示被搜的那张图的向量编号。
 */
const displayTitle = computed(() => {
  if (sourceTag.value === 'byId' && currentVectorId.value) {
    return $t('erp.orderVector.search.queryByIdLabel', [currentVectorId.value]);
  }
  if (queryFile.value) return queryFile.value.name;
  return '';
});

/**
 * 调用 searchById 拿到 SearchResult[] 后，从第一项的 imagePath 把"被搜的那张图"
 * 渲染出来。但 searchById 命中列表的第一条可能是"自己"，
 * 这里允许通过后端返回的列表自动取 imagePath。
 *
 * <p>为了健壮性，单独包一层：searchOrderVectorById 抛错时返回空数组。
 */
async function searchOrderImageByIdWithFallback(
  id: string,
  k: number,
): Promise<any[]> {
  try {
    return await searchOrderVectorById(id, k);
  } catch {
    return [];
  }
}

onMounted(() => {
  initFromRoute();
});

const [ViewFormModalDrawer, viewFormModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: FormView,
  destroyOnClose: true,
  type: 'drawer',
  externalCloseConfirm: false,
});

const { copy } = useClipboard({ legacy: true });

/** 复制订单号 */
async function handleCopyOrderNo(orderNo: string) {
  if (!orderNo) return;
  try {
    await copy(orderNo);
    message.success($t('ui.actionMessage.copySuccess'));
  } catch {
    message.error($t('infra.file.message.copyFailed'));
  }
}

/** 查看订单信息 */
function handleView(orderNo: string) {
  if (!orderNo) return;
  viewFormModalDrawerApi.setData({ orderNo }).open();
}
</script>

<template>
  <Page auto-content-height>
    <ViewFormModalDrawer />
    <div class="flex flex-col gap-4 px-4 pb-2">
      <!-- 顶部：标题 -->
      <header class="flex items-center justify-between">
        <h2 class="text-base font-medium">
          {{ $t('erp.orderVector.search.modalTitle') }}
        </h2>
      </header>

      <!-- 上面：上传查询图 + TopK -->
      <section class="flex flex-col items-center gap-4">
        <!--        <h4 class="text-sm font-medium text-gray-700">-->
        <!--          {{ $t('erp.orderVector.search.uploadTitle') }}-->
        <!--        </h4>-->
        <div class="flex w-full justify-center gap-4">
          <div class="flex w-64 shrink-0 flex-col gap-2">
            <Upload.Dragger
              name="file"
              :max-count="1"
              accept=".jpg,.jpeg,.png,.webp"
              :before-upload="beforeUpload"
              class="!w-64"
              list-type="picture-card"
              :show-upload-list="false"
            >
              <p v-if="!queryImageUrl" class="ant-upload-drag-icon">
                <span class="icon-[ant-design--inbox-outlined] text-2xl"></span>
              </p>
              <div v-if="!queryImageUrl" class="text-sm">
                <p class="ant-upload-text">
                  {{ $t('erp.orderVector.search.uploadTitle') }}
                </p>
                <p class="ant-upload-hint">
                  {{ $t('erp.orderVector.search.uploadHint') }}
                </p>
              </div>
              <div v-else class="w-full">
                <Image
                  :src="queryImageUrl"
                  :preview="false"
                  class="max-h-[140px] max-w-full object-contain"
                />
                <p
                  v-if="displayTitle"
                  class="mt-1 truncate text-xs"
                  :title="displayTitle"
                >
                  {{ displayTitle }}
                </p>
              </div>
            </Upload.Dragger>

            <!-- 粘贴框：单张图片，Ctrl+V 直接替换当前查询图 -->
            <div class="paste-hint" @click="focusPasteTarget">
              <input
                ref="pasteInputRef"
                type="text"
                tabindex="-1"
                :value="pasteInputValue"
                @paste="handlePaste"
                @input="onPasteInputChange"
                class="paste-hint-input"
                aria-hidden="true"
              />
              <span v-if="!pasteInputValue" class="paste-hint-placeholder">
                {{ $t('ui.upload.pasteHint') }}
              </span>
            </div>
          </div>

          <div class="flex max-w-md flex-1 flex-col gap-3">
            <div class="flex items-center gap-3">
              <label class="whitespace-nowrap text-sm">
                {{ $t('erp.orderVector.search.topK') }}:
              </label>
              <a-input-number
                v-model:value="topK"
                :min="1"
                :max="1000"
                class="!w-32"
              />
            </div>
            <div class="flex items-center gap-2">
              <a-button
                type="primary"
                :loading="submitting"
                :disabled="!canSearch"
                @click="runSearchByUpload"
              >
                {{ $t('erp.orderVector.search.actionSearch') }}
              </a-button>
              <a-button v-if="hasImage || queryImageUrl" @click="resetQuery">
                {{ $t('erp.orderVector.search.clear') }}
              </a-button>
              <a-spin v-if="submitting" />
            </div>
            <p class="text-xs text-gray-500">
              {{
                hasResults
                  ? $t('erp.orderVector.search.tipReupload', [results.length])
                  : $t('erp.orderVector.search.tip')
              }}
            </p>
          </div>
        </div>
      </section>

      <a-divider class="!my-2" />

      <!-- 下面：搜索结果 -->
      <section>
        <h4 class="mb-2 text-sm font-medium text-gray-700">
          {{
            hasResults
              ? $t('erp.orderVector.search.result', [results.length])
              : $t('erp.orderVector.search.resultEmpty')
          }}
        </h4>
        <div
          v-if="submitting && !hasResults"
          class="py-12 text-center text-sm text-gray-400"
        >
          <a-spin />
          <span class="ml-2">{{ $t('erp.orderVector.search.loading') }}</span>
        </div>
        <div v-else-if="!hasResults" class="py-12 text-center text-gray-400">
          {{ $t('erp.orderVector.search.empty') }}
        </div>
        <div
          v-else
          class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          <div
            v-for="(r, idx) in results"
            :key="`${lastQueryTime}-${r.id ?? idx}`"
            class="overflow-hidden rounded-md border border-gray-100 shadow-sm transition hover:shadow-md"
          >
            <div class="flex h-64 items-center justify-center">
              <Image
                :src="r.imagePath"
                :preview="{ src: r.imagePath }"
                class="max-h-64 max-w-full object-contain"
                fallback="/fallback.png"
              />
            </div>
            <div class="p-2 text-xs">
              <div class="truncate font-mono text-gray-700" :title="r.id">
                <span
                  class="min-w-0 flex-1 truncate text-xs"
                  :title="r.originKey"
                >
                  {{ $t('erp.orderAudit.field.orderNo') }}:
                  {{ r.originKey }}
                </span>
              </div>
              <div class="mt-1 flex items-center gap-2 text-gray-700">
                <a-tag class="shrink-0 text-blue-600">{{ r.similarity }}</a-tag>
                <span class="min-w-0 flex-1"></span>
                <a-button
                  size="small"
                  :disabled="!r.originKey"
                  @click="handleCopyOrderNo(r.originKey)"
                >
                  {{ $t('common.copy') }}
                </a-button>
                <a-button
                  size="small"
                  v-if="hasAccessByCodes(['erp:order:query'])"
                  @click="handleView(r.originKey)"
                >
                  {{ $t('common.view') }}
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Page>
</template>

<style scoped>
/* 单图粘贴框：模拟 antd Input 外观 */
.paste-hint {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius);
  background: hsl(var(--input-background));
  color: hsl(var(--foreground));
  outline: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  cursor: text;
}
.paste-hint:focus-within {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
}
.paste-hint-input {
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: transparent;
  caret-color: hsl(var(--foreground));
  padding: 0;
  margin: 0;
  min-width: 0;
  text-shadow: none;
}
.paste-hint-placeholder {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: hsl(var(--input-placeholder));
  pointer-events: none;
  user-select: none;
}
</style>
