<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Image, message, Upload } from 'ant-design-vue';

import { searchVectorImageByUpload } from '#/api/infra/vector/image';
import {
  previewFileAsDataURL,
  useImagePasteUpload,
} from '#/composables/use-image-paste-upload';
import { $t } from '#/locales';

const queryFile = ref<FileType | null>(null);
const queryImageUrl = ref<string>('');
const topK = ref<number>(100);
const submitting = ref(false);

const results = ref<any[]>([]);
const lastQueryTime = ref<number>(0);
const sourceTag = ref<'byId' | 'upload'>('upload');

const hasImage = computed(() => !!queryFile.value);
const hasResults = computed(() => results.value.length > 0);

/**
 * 左侧查询图下方的文件名 / 标题。
 * <ul>
 *   <li>upload 模式：显示用户上传的文件名。</li>
 *   <li>byId 模式：没有真文件，显示"按编号查询：xxx"（来自父组件 setData 时塞的 byRowId）。</li>
 * </ul>
 */
// @ts-ignore 后面有用
const displayTitle = computed(() => {
  if (queryFile.value) return queryFile.value.name;
  // byId 模式下 queryImageUrl 由父组件传进来；rowId 也透传过来以便显示。
  const data = (modalApi.getData?.() ?? null) as null | { byRowId?: string };
  if (data?.byRowId) {
    return $t('infra.vectorImage.search.queryByIdLabel', [data.byRowId]);
  }
  return '';
});

/**
 * "开始搜索"按钮可点条件：
 * <ul>
 *   <li>byId 模式：父组件已经搜过一次了，按钮不可点（避免重复搜）。</li>
 *   <li>upload 模式：必须上传了真 File。</li>
 * </ul>
 */
const canSearch = computed(
  () => sourceTag.value === 'upload' && hasImage.value,
);

/**
 * 单张图片粘贴框：Ctrl+V 直接替换当前查询图，
 * 行为和 Upload.Dragger 的 beforeUpload 完全一致 —— 替换 file / 清结果 / 切回 upload 模式。
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

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      // 关掉时重置，便于下次以干净状态打开（无论是"上传搜"还是"按行 id 搜"）
      resetAll();
      return;
    }
    // 打开时读父组件塞进来的数据
    const data = (modalApi.getData?.() ?? null) as null | {
      byRowId?: string;
      queryImageUrl?: string;
      results?: any[];
    };
    if (data?.results && Array.isArray(data.results)) {
      results.value = data.results;
      lastQueryTime.value = Date.now();
      sourceTag.value = 'byId';
      // 默认显示被搜的那张图（来自父组件透传的 row.imagePath）。
      // queryFile 仍留 null——byId 模式下 onConfirm 直接 close，不走上传搜。
      // 用户点"清空"后由 resetQuery 切回 upload 模式，那时再上传新图搜。
      queryFile.value = null;
      queryImageUrl.value = data.queryImageUrl ?? '';
    } else {
      sourceTag.value = 'upload';
      results.value = [];
      queryFile.value = null;
      queryImageUrl.value = '';
    }
  },
  async onConfirm() {
    if (sourceTag.value === 'byId') {
      // 按 id 的搜索结果只是查看，不需要再次确认
      await modalApi.close();
      return;
    }
    await runSearch();
  },
});

function resetAll() {
  results.value = [];
  queryFile.value = null;
  queryImageUrl.value = '';
  lastQueryTime.value = 0;
  sourceTag.value = 'upload';
}

async function runSearch() {
  if (!queryFile.value) {
    message.warning($t('infra.vectorImage.message.searchEmpty'));
    return;
  }
  submitStart();
  try {
    const data = await searchVectorImageByUpload(
      { file: queryFile.value as File },
      topK.value,
    );
    results.value = Array.isArray(data) ? data : [];
    lastQueryTime.value = Date.now();
    if (results.value.length === 0) {
      message.info($t('infra.vectorImage.search.empty'));
    }
  } catch (error: any) {
    console.error(
      $t('infra.vectorImage.message.searchFailed', [
        error?.message ?? queryFile.value.name,
      ]),
    );
  } finally {
    submitEnd();
  }
}

function submitStart() {
  submitting.value = true;
  modalApi.lock();
}

function submitEnd() {
  submitting.value = false;
  modalApi.unlock();
}

/** 上传前预览 */
function beforeUpload(file: FileType) {
  if (!file.type?.startsWith?.('image/')) {
    message.error($t('infra.vectorImage.upload.hint'));
    return Upload.LIST_IGNORE;
  }
  // 替换为新查询：换一张图，自动清空旧结果
  queryFile.value = file;
  queryImageUrl.value = '';
  results.value = [];
  // 用户从 drag 区拖了新图上来（无论之前是 upload 还是 byId 模式），
  // 都切回 upload 模式 —— 否则 onConfirm 会走 byId 的"直接关闭"逻辑，
  // 让用户按"开始搜索"却没反应。
  sourceTag.value = 'upload';
  const reader = new FileReader();
  reader.addEventListener('load', (e) => {
    queryImageUrl.value = (e.target?.result as string) ?? '';
  });
  reader.readAsDataURL(file);
  return false;
}

/**
 * 清空当前查询图（无论是 byId 默认填充的还是用户上传的）。
 * 顺手把 sourceTag 切回 upload，这样下次点"搜索"会走上传搜路径。
 */
function resetQuery() {
  queryFile.value = null;
  queryImageUrl.value = '';
  sourceTag.value = 'upload';
}
</script>

<template>
  <Modal :title="$t('infra.vectorImage.search.modalTitle')" class="w-[75%]">
    <div class="flex flex-col gap-4 px-4 pb-2">
      <!-- 上面：上传查询图 + TopK -->
      <section class="flex justify-center gap-4">
        <h4 class="mb-2 text-sm font-medium text-gray-700">
          {{ $t('infra.vectorImage.search.uploadTitle') }}
        </h4>
        <div class="flex justify-center gap-4">
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
                  {{ $t('infra.vectorImage.search.uploadTitle') }}
                </p>
                <p class="ant-upload-hint">
                  {{ $t('infra.vectorImage.search.uploadHint') }}
                </p>
              </div>
              <div v-else class="w-full">
                <Image
                  :src="queryImageUrl"
                  :preview="false"
                  class="max-h-[140px] max-w-full object-contain"
                />
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

          <div class="flex flex-1 flex-col gap-3">
            <div class="flex items-center gap-3">
              <label class="whitespace-nowrap text-sm">
                {{ $t('infra.vectorImage.search.topK') }}:
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
                @click="runSearch"
              >
                {{ $t('infra.vectorImage.search.actionSearch') }}
              </a-button>
              <a-button
                v-if="hasImage || queryImageUrl"
                size="small"
                @click="resetQuery"
              >
                {{ $t('common.clear') }}
              </a-button>
              <a-spin v-if="submitting" />
            </div>
            <p class="text-xs text-gray-500">
              {{
                hasResults
                  ? $t('infra.vectorImage.search.tipReupload', [results.length])
                  : $t('infra.vectorImage.search.tip')
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
              ? $t('infra.vectorImage.search.result', [results.length])
              : $t('infra.vectorImage.search.resultEmpty')
          }}
        </h4>
        <div
          v-if="submitting && !hasResults"
          class="py-12 text-center text-sm text-gray-400"
        >
          <a-spin />
          <span class="ml-2">{{ $t('infra.vectorImage.search.loading') }}</span>
        </div>
        <div v-else-if="!hasResults" class="py-12 text-center text-gray-400">
          {{ $t('infra.vectorImage.search.empty') }}
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
            <div class="flex h-32 items-center justify-center">
              <Image
                :src="r.imagePath"
                :preview="{ src: r.imagePath }"
                class="max-h-32 max-w-full object-contain"
                fallback="/fallback.png"
              />
            </div>
            <div class="p-2 text-xs">
              <div class="truncate font-mono text-gray-700" :title="r.id">
                ID: {{ r.id }}
              </div>
              <div class="mt-1 flex justify-between text-gray-500">
                <span class="text-blue-600">{{ r.similarity }}</span>
                <span>score: {{ r.score?.toFixed?.(4) ?? r.score }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Modal>
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
  transition: border-color 0.2s, box-shadow 0.2s;
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
