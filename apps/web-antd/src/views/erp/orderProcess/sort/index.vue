<script lang="ts" setup>
import type { CardField } from './data';

import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { nextTick, reactive, ref, useTemplateRef } from 'vue';

import { Page } from '@vben/common-ui';

import { message, Pagination } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  getOrderProcess,
  getOrderProcessPage,
  updateOrderProcess,
} from '#/api/erp/orderProcess';
import I18nDictTag from '#/components/i18n/i18n-dict-tag/i18n-dict-tag.vue';
import { $t } from '#/locales';

import {
  CARD_PAGE_SIZE_OPTIONS,
  LEFT_CARD_FIELDS,
  LEFT_PROCESS_VALUE,
  RIGHT_CARD_FIELDS,
  RIGHT_EXCLUDED_PROCESSES,
  useDetailSchema,
  useSearchSchema,
} from './data';

/** 顶部查询表单 */
const [SearchForm, searchFormApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 80,
  },
  layout: 'horizontal',
  wrapperClass: 'grid-cols-4',
  schema: useSearchSchema(),
  showDefaultActions: false,
});

/** 列表查询参数 */
const queryParams = ref<Record<string, any>>({});

/** 左/右卡片分页与数据 */
type PaneState = {
  list: OrderProcessApi.OrderProcess[];
  loading: boolean;
  pageNo: number;
  pageSize: number;
  total: number;
};

const leftPane = reactive<PaneState>({
  list: [],
  total: 0,
  loading: false,
  pageNo: 1,
  pageSize: Number(CARD_PAGE_SIZE_OPTIONS[0]),
});

const rightPane = reactive<PaneState>({
  list: [],
  total: 0,
  loading: false,
  pageNo: 1,
  pageSize: Number(CARD_PAGE_SIZE_OPTIONS[0]),
});

const leftScrollRef = useTemplateRef<HTMLElement>('leftScrollRef');
const rightScrollRef = useTemplateRef<HTMLElement>('rightScrollRef');

/** 选中项（中间详情） */
const selectedRow = ref<null | OrderProcessApi.OrderProcess>(null);

/** 滚动到顶部 */
function scrollToTop(el?: HTMLElement | null) {
  if (!el) return;
  el.scrollTo({ top: 0, behavior: 'smooth' });
}

/** 加载左侧：currentProcess = 2 */
async function loadLeft() {
  leftPane.loading = true;
  try {
    const res = await getOrderProcessPage({
      pageNo: leftPane.pageNo,
      pageSize: leftPane.pageSize,
      ...queryParams.value,
      currentProcess: LEFT_PROCESS_VALUE,
    });
    leftPane.list = res.list ?? [];
    leftPane.total = Number(res.total ?? 0);
  } finally {
    leftPane.loading = false;
  }
}

/** 加载右侧：currentProcess NOT IN (1, 2) */
async function loadRight() {
  rightPane.loading = true;
  try {
    const res = await getOrderProcessPage({
      pageNo: rightPane.pageNo,
      pageSize: rightPane.pageSize,
      ...queryParams.value,
      notInCurrentProcesses: RIGHT_EXCLUDED_PROCESSES,
    });
    rightPane.list = res.list ?? [];
    rightPane.total = Number(res.total ?? 0);
  } finally {
    rightPane.loading = false;
  }
}

async function refreshAll() {
  leftPane.pageNo = 1;
  rightPane.pageNo = 1;
  await Promise.all([loadLeft(), loadRight()]);
  scrollToTop(leftScrollRef.value);
  scrollToTop(rightScrollRef.value);
  syncSelectedAfterRefresh();
}

/** 顶部查询 -> 触发刷新 */
async function handleSearch() {
  const values = await searchFormApi.getValues();
  queryParams.value = values || {};
  await refreshAll();
}

/** 重置查询 */
async function handleReset() {
  await searchFormApi.resetForm();
  queryParams.value = {};
  await refreshAll();
}

/** 分页变化 */
async function handleLeftPageChange(page: number, pageSize: number) {
  leftPane.pageNo = page;
  leftPane.pageSize = pageSize;
  await loadLeft();
  await nextTick();
  scrollToTop(leftScrollRef.value);
}
async function handleRightPageChange(page: number, pageSize: number) {
  rightPane.pageNo = page;
  rightPane.pageSize = pageSize;
  await loadRight();
  await nextTick();
  scrollToTop(rightScrollRef.value);
}

/** 卡片点击：选中并加载详情到中间 */
const detailLoading = ref(false);
async function selectRow(row: OrderProcessApi.OrderProcess) {
  selectedRow.value = row;
  detailLoading.value = true;
  try {
    const detail = await getOrderProcess(row.id as number);
    detailFormApi.setValues(detail);
    detailFormApi.setState({ commonConfig: { disabled: false } });
  } finally {
    detailLoading.value = false;
  }
}

/** 刷新后如果选中项已不在左右列表中，清空选中 */
function syncSelectedAfterRefresh() {
  if (!selectedRow.value) return;
  const stillExists =
    leftPane.list.some((it) => it.id === selectedRow.value!.id) ||
    rightPane.list.some((it) => it.id === selectedRow.value!.id);
  if (!stillExists) {
    selectedRow.value = null;
    detailFormApi.setValues({});
    detailFormApi.setState({ commonConfig: { disabled: true } });
  }
}

const [DetailForm, detailFormApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 80,
  },
  layout: 'horizontal',
  wrapperClass: 'grid-cols-4',
  schema: useDetailSchema(),
  showDefaultActions: false,
});

/** 默认只读 */
detailFormApi.setState({ commonConfig: { disabled: true } });

/** 保存中间详情 */
const saving = ref(false);
async function handleSave() {
  if (!selectedRow.value?.id) return;
  const { valid } = await detailFormApi.validate();
  if (!valid) return;
  saving.value = true;
  try {
    const values = await detailFormApi.getValues();
    await updateOrderProcess(values as OrderProcessApi.OrderProcess);
    message.success($t('ui.actionMessage.operationSuccess'));
    await Promise.all([loadLeft(), loadRight()]);
    scrollToTop(leftScrollRef.value);
    scrollToTop(rightScrollRef.value);
    syncSelectedAfterRefresh();
  } finally {
    saving.value = false;
  }
}

/** 卡片选中态 */
const isLeftSelected = (row: OrderProcessApi.OrderProcess) =>
  selectedRow.value?.id === row.id;
const isRightSelected = (row: OrderProcessApi.OrderProcess) =>
  selectedRow.value?.id === row.id;

/** 卡片字段原值（空安全） */
function getCardRaw(item: OrderProcessApi.OrderProcess, field: CardField) {
  const raw = (item as any)[field.field];
  if (raw === undefined || raw === null || raw === '') return null;
  return raw;
}

/** 首次加载 */
refreshAll();
</script>

<template>
  <Page auto-content-height>
    <div class="sort-page">
      <!-- 顶部搜索区：与原列表一致 -->
      <div class="sort-search">
        <SearchForm />
        <div class="sort-search__actions">
          <a-button type="primary" @click="handleSearch">
            {{ $t('common.search') }}
          </a-button>
          <a-button @click="handleReset">
            {{ $t('common.reset') }}
          </a-button>
        </div>
      </div>

      <!-- 主体三栏布局 -->
      <div class="sort-body">
        <!-- 左侧卡片 -->
        <div class="sort-pane">
          <div class="sort-pane__head">
            <span class="sort-pane__title">
              {{ $t('erp.orderProcess.pane.pendingTitle') }}
            </span>
            <span class="sort-pane__count">
              {{ leftPane.total }}
            </span>
          </div>
          <div ref="leftScrollRef" class="sort-pane__scroll">
            <a-spin :spinning="leftPane.loading" class="sort-pane__spin">
              <a-empty v-if="!leftPane.loading && leftPane.list.length === 0" />
              <div
                v-for="item in leftPane.list"
                :key="`left-${item.id}`"
                class="sort-card"
                :class="{ 'sort-card--active': isLeftSelected(item) }"
                @click="selectRow(item)"
              >
                <div class="sort-card__header">
                  <span class="sort-card__no">#{{ item.orderNo }}</span>
                  <I18nDictTag
                    v-if="item.currentProcess"
                    type="erp_order_current_process"
                    :value="item.currentProcess"
                    class="sort-card__tag"
                  />
                </div>
                <div class="sort-card__body">
                  <div
                    v-for="f in LEFT_CARD_FIELDS"
                    :key="String(f.field)"
                    class="sort-card__row"
                    :class="`sort-card__row--span-${f.span ?? 1}`"
                  >
                    <span class="sort-card__label">{{ f.label }}</span>
                    <a-image
                      v-if="f.type === 'image' && (item as any)[f.field]"
                      :src="(item as any)[f.field]"
                      :width="48"
                      :height="48"
                      class="sort-card__image"
                    />
                    <div
                      v-else-if="f.dictType && getCardRaw(item, f) !== null"
                      class="sort-card__value sort-card__value--dict"
                    >
                      <I18nDictTag
                        :type="f.dictType"
                        :value="getCardRaw(item, f)"
                      />
                    </div>
                    <span v-else class="sort-card__value">
                      {{ getCardRaw(item, f) ?? '-' }}
                    </span>
                  </div>
                </div>
              </div>
            </a-spin>
          </div>
          <div v-if="leftPane.total > 0" class="sort-pane__pager">
            <Pagination
              :current="leftPane.pageNo"
              :page-size="leftPane.pageSize"
              :total="leftPane.total"
              :page-size-options="CARD_PAGE_SIZE_OPTIONS"
              :show-quick-jumper="false"
              show-size-changer
              show-less-items
              size="small"
              @change="handleLeftPageChange"
            />
          </div>
        </div>

        <!-- 中间详情 -->
        <div class="sort-pane sort-pane--center">
          <div class="sort-pane__head">
            <span class="sort-pane__title">
              {{
                selectedRow
                  ? `${$t('erp.orderProcess.orderProcess')} · #${selectedRow.orderNo}`
                  : $t('erp.orderProcess.orderProcess')
              }}
            </span>
            <a-button
              type="primary"
              size="small"
              :disabled="!selectedRow?.id"
              :loading="saving"
              @click="handleSave"
            >
              {{ $t('common.save') }}
            </a-button>
          </div>
          <div class="sort-pane__scroll">
            <a-spin :spinning="detailLoading" class="sort-pane__spin">
              <a-empty
                v-if="!detailLoading && !selectedRow"
                :description="$t('erp.orderProcess.selectRowHint')"
              />
              <DetailForm v-else class="sort-detail" />
            </a-spin>
          </div>
        </div>

        <!-- 右侧卡片 -->
        <div class="sort-pane">
          <div class="sort-pane__head">
            <span class="sort-pane__title">
              {{ $t('erp.orderProcess.pane.layoutTitle') }}
            </span>
            <span class="sort-pane__count">
              {{ rightPane.total }}
            </span>
          </div>
          <div ref="rightScrollRef" class="sort-pane__scroll">
            <a-spin :spinning="rightPane.loading" class="sort-pane__spin">
              <a-empty
                v-if="!rightPane.loading && rightPane.list.length === 0"
              />
              <div
                v-for="item in rightPane.list"
                :key="`right-${item.id}`"
                class="sort-card"
                :class="{ 'sort-card--active': isRightSelected(item) }"
                @click="selectRow(item)"
              >
                <div class="sort-card__header">
                  <span class="sort-card__no">#{{ item.orderNo }}</span>
                  <I18nDictTag
                    v-if="item.currentProcess"
                    type="erp_order_current_process"
                    :value="item.currentProcess"
                    class="sort-card__tag"
                  />
                </div>
                <div class="sort-card__body">
                  <div
                    v-for="f in RIGHT_CARD_FIELDS"
                    :key="String(f.field)"
                    class="sort-card__row"
                    :class="`sort-card__row--span-${f.span ?? 1}`"
                  >
                    <span class="sort-card__label">{{ f.label }}</span>
                    <a-image
                      v-if="f.type === 'image' && (item as any)[f.field]"
                      :src="(item as any)[f.field]"
                      :width="48"
                      :height="48"
                      class="sort-card__image"
                    />
                    <div
                      v-else-if="f.dictType && getCardRaw(item, f) !== null"
                      class="sort-card__value sort-card__value--dict"
                    >
                      <I18nDictTag
                        :type="f.dictType"
                        :value="getCardRaw(item, f)"
                      />
                    </div>
                    <span v-else class="sort-card__value">
                      {{ getCardRaw(item, f) ?? '-' }}
                    </span>
                  </div>
                </div>
              </div>
            </a-spin>
          </div>
          <div v-if="rightPane.total > 0" class="sort-pane__pager">
            <Pagination
              :current="rightPane.pageNo"
              :page-size="rightPane.pageSize"
              :total="rightPane.total"
              :page-size-options="CARD_PAGE_SIZE_OPTIONS"
              :show-quick-jumper="false"
              show-size-changer
              show-less-items
              size="small"
              @change="handleRightPageChange"
            />
          </div>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
/* 使用 vben 自身的设计 token，自动适配浅/深色模式 */
.sort-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  gap: 12px;
}

.sort-search {
  background-color: hsl(var(--card));
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 1px 4px hsl(var(--foreground) / 0.04);
  flex-shrink: 0;
}

.sort-search__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

.sort-body {
  display: grid;
  /* 左右各 20%，中间 60%，不超出页面宽度 */
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 2.5fr) minmax(0, 1.15fr);
  gap: 12px;
  flex: 1;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
}

.sort-pane {
  display: flex;
  flex-direction: column;
  background-color: hsl(var(--card));
  border-radius: 8px;
  box-shadow: 0 1px 4px hsl(var(--foreground) / 0.04);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.sort-pane__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid hsl(var(--border));
  font-weight: 600;
  flex-shrink: 0;
}

.sort-pane__title {
  font-size: 14px;
  color: hsl(var(--foreground));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sort-pane__count {
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  padding: 2px 8px;
  border-radius: 999px;
  background-color: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  flex-shrink: 0;
  min-width: 28px;
  text-align: center;
}

.sort-pane__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.sort-pane__spin {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.sort-pane__pager {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid hsl(var(--border));
  flex-shrink: 0;
  background-color: hsl(var(--popover));
}

.sort-card {
  margin: 10px auto;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
  background-color: hsl(var(--popover));
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.03);
}

.sort-card:hover {
  border-color: hsl(var(--primary));
  box-shadow: 0 4px 12px hsl(var(--primary) / 0.15);
}

.sort-card--active {
  border-color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 0.06);
  box-shadow: 0 0 0 1px hsl(var(--primary));
}

.sort-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed hsl(var(--border));
}

.sort-card__no {
  font-weight: 600;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.sort-card__tag {
  margin: 0;
  flex-shrink: 0;
}

.sort-card__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 14px;
  row-gap: 10px;
}

.sort-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.sort-card__row--span-2 {
  grid-column: span 2;
}

.sort-card__label {
  flex-shrink: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.2px;
}

.sort-card__value {
  flex: 1;
  min-width: 0;
  text-align: right;
  font-size: 13px;
  color: hsl(var(--foreground));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sort-card__value--dict {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.sort-card__value--dict :deep(.justify-center) {
  justify-content: flex-end;
}

.sort-card__image {
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid hsl(var(--border));
  object-fit: cover;
}

.sort-detail {
  padding: 8px 14px 16px;
}
.ant-pagination {
  white-space: nowrap;
}
</style>
