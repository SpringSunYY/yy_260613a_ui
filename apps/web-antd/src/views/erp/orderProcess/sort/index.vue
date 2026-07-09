<script lang="ts" setup>
import type { CardField } from './data';

import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { computed, nextTick, reactive, ref, useTemplateRef } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModelDrawer } from '@vben/common-ui';

import { message, Pagination } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  getOrderProcess,
  getOrderProcessPage,
  updateOrderProcess,
  updateProcessToTargetProcess,
} from '#/api/erp/orderProcess';
import I18nDictTag from '#/components/i18n/i18n-dict-tag/i18n-dict-tag.vue';
import { $t } from '#/locales';
import { ErpOrderCurrentProcess } from '#/utils';
import ShipForm from '#/views/erp/order/modules/ship-form.vue';

import {
  CARD_PAGE_SIZE_OPTIONS,
  LEFT_CARD_FIELDS,
  LEFT_PROCESS_VALUE,
  RIGHT_CARD_FIELDS,
  RIGHT_EXCLUDED_PROCESSES,
  useDetailSchema,
  useSearchSchema,
} from './data';

const { hasAccessByCodes } = useAccess();

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
  if (selectedRow.value?.id) {
    await reselectRow(selectedRow.value.id);
  } else {
    selectedRow.value = null;
    detailFormApi.setValues({});
    detailFormApi.setState({ commonConfig: { disabled: true } });
  }
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

/** 详情加载态 */
const detailLoading = ref(false);

/** 在某个 pane 的列表里按 id 找出最新一行的引用 */
function findRowInPane(id: number, list: OrderProcessApi.OrderProcess[]) {
  return list.find((it) => it.id === id) ?? null;
}

/**
 * 刷新左右两侧后，按 id 重新定位当前选中项
 * - 命中左侧：selectedRow 指向 leftPane.list 里那一行
 * - 命中右侧：同理
 * - 推进工序后会自然发生跨 pane 切换
 * - 命中后重新拉详情，保证中间表单拿到最新数据
 */
async function reselectRow(targetId: number) {
  let next: null | OrderProcessApi.OrderProcess = findRowInPane(
    targetId,
    leftPane.list,
  );
  if (!next) {
    next = findRowInPane(targetId, rightPane.list);
  }
  if (!next) {
    // 理论上保存/推进后仍可能因为过滤条件被排除掉
    selectedRow.value = null;
    detailFormApi.setValues({});
    detailFormApi.setState({ commonConfig: { disabled: true } });
    return;
  }
  selectedRow.value = next;
  detailLoading.value = true;
  try {
    await detailFormApi.resetForm();
    const detail = await getOrderProcess(next.id as number);
    await detailFormApi.setValues(detail);
    detailFormApi.setState({ commonConfig: { disabled: false } });
  } finally {
    detailLoading.value = false;
  }
}

/** 主动选择某行：详情已由调用方刷新，这里只同步 selectedRow 引用 + 拉详情 */
async function selectRow(row: OrderProcessApi.OrderProcess) {
  await reselectRow(row.id as number);
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
async function toSelectRow(targetId: number) {
  await Promise.all([loadLeft(), loadRight()]);
  scrollToTop(leftScrollRef.value);
  scrollToTop(rightScrollRef.value);
  await reselectRow(targetId);
}
async function handleSave() {
  if (!selectedRow.value?.id) return;
  const targetId = selectedRow.value.id;
  const { valid } = await detailFormApi.validate();
  if (!valid) return;
  saving.value = true;
  try {
    const values = await detailFormApi.getValues();
    await updateOrderProcess(values as OrderProcessApi.OrderProcess);
    message.success($t('ui.actionMessage.operationSuccess'));
    await toSelectRow(targetId);
  } finally {
    saving.value = false;
  }
}

/** 推进工序 */
async function handleToTargetProcess(targetProcess: string) {
  if (!selectedRow.value?.id) return;
  const { valid } = await detailFormApi.validate();
  if (!valid) return;
  const targetId = selectedRow.value.id;
  saving.value = true;
  try {
    const values =
      (await detailFormApi.getValues()) as OrderProcessApi.OrderProcess;
    await updateProcessToTargetProcess({
      ...values,
      currentProcess: targetProcess,
    });
    await toSelectRow(targetId);
    message.success($t('ui.actionMessage.operationSuccess'));
  } finally {
    saving.value = false;
  }
}

function confirmToTargetProcess(targetProcess: string) {
  if (selectedRow.value === null) {
    return;
  }
  // // 如果是发货
  if (targetProcess === ErpOrderCurrentProcess.CURRENT_PROCESS_7) {
    return handleOrderShip();
  }
  handleToTargetProcess(targetProcess);
}

/**
 * 工序推进动作配置：根据当前工序计算可用的「完成 XX」操作
 * - currentProcess=2 待排版  -> 完成排版 -> 3
 * - currentProcess=3 待打纸  -> 完成打纸 -> 4
 * - currentProcess=4 待滚筒  -> 完成滚筒 -> 5
 * - currentProcess=5 待激光  -> 完成激光 -> 6
 * - currentProcess=6 待裁缝发货 -> 完成裁缝发货 -> 7
 * - 1 草稿 / 7 完结 不展示
 */
const processActions = computed(() => {
  const order = [
    ErpOrderCurrentProcess.CURRENT_PROCESS_2,
    ErpOrderCurrentProcess.CURRENT_PROCESS_3,
    ErpOrderCurrentProcess.CURRENT_PROCESS_4,
    ErpOrderCurrentProcess.CURRENT_PROCESS_5,
    ErpOrderCurrentProcess.CURRENT_PROCESS_6,
    ErpOrderCurrentProcess.CURRENT_PROCESS_7,
  ] as const;
  const labels: Record<(typeof order)[number], string> = {
    [ErpOrderCurrentProcess.CURRENT_PROCESS_2]:
      'erp.orderProcess.action.layout',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_3]: 'erp.orderProcess.action.paper',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_4]:
      'erp.orderProcess.action.roller',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_5]: 'erp.orderProcess.action.laser',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_6]: 'erp.orderProcess.action.ship',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_7]:
      'erp.orderProcess.action.complete',
  };
  // 每个工序独立权限码
  const auths: Record<(typeof order)[number], string> = {
    [ErpOrderCurrentProcess.CURRENT_PROCESS_2]: 'erp:order-process:layout',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_3]: 'erp:order-process:paper',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_4]: 'erp:order-process:roller',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_5]: 'erp:order-process:laser',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_6]: 'erp:order-process:ship',
    [ErpOrderCurrentProcess.CURRENT_PROCESS_7]: 'erp:order-process:complete',
  };
  // 只生成向前推进一格的动作（最后一格不生成"完成"，由 6 进入 7 完结由其它入口处理）
  return order.slice(0, -1).map((current, index) => {
    const target = order[index + 1] as (typeof order)[number];
    return {
      key: current,
      i18nKey: labels[current],
      target,
      auth: auths[current],
    };
  });
});

/** 发货*/
const [ShipFormModalDrawer, shipFormModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: ShipForm,
  destroyOnClose: true,
  type: 'modal',
});
async function handleOrderShip() {
  if (!selectedRow.value?.id) return;
  const { valid } = await detailFormApi.validate();
  if (!valid) return;
  shipFormModalDrawerApi.setData(selectedRow.value).open();
}

/** 当前选中行可执行的动作（按当前工序 + 权限过滤） */
const currentActions = computed(() => {
  const current = selectedRow.value?.currentProcess;
  if (!current) return [];
  return processActions.value
    .filter((a) => a.key === current)
    .filter((a) => hasAccessByCodes([a.auth]));
});

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
    <ShipFormModalDrawer @success="toSelectRow(selectedRow.id)" />
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
            <span class="sort-pane__actions">
              <a-popconfirm
                v-for="action in currentActions"
                :key="action.key"
                :disabled="!selectedRow?.id"
                :title="
                  $t('ui.actionMessage.submitConfirm', [
                    $t('erp.orderProcess.orderProcess'),
                  ])
                "
                :ok-text="$t('common.confirm')"
                :cancel-text="$t('common.cancel')"
                @confirm="confirmToTargetProcess(action.target)"
              >
                <a-button
                  size="small"
                  :disabled="!selectedRow?.id"
                  :loading="saving"
                >
                  {{ $t(action.i18nKey) }}
                </a-button>
              </a-popconfirm>
              <a-button
                type="primary"
                size="small"
                :disabled="!selectedRow?.id"
                :loading="saving"
                @click="handleSave"
              >
                {{ $t('common.save') }}
              </a-button>
            </span>
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

.sort-pane__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
