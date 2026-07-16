<script lang="ts" setup>
import type { OrderApi } from '#/api/erp/order';
/**
 * 订单明细组件 - 基于 Jspreadsheet CE
 * 支持 Excel 风格的原生复制粘贴功能
 */
import type { JspreadsheetInstance } from '#/components/jspreadsheet';

import { computed, h, ref, watch } from 'vue';

import { Plus } from '@vben/icons';

import { Button, Card, message } from 'ant-design-vue';

import { getOrderDetailListByOrderNo } from '#/api/erp/order';
import { Jspreadsheet } from '#/components/jspreadsheet';
import { $t } from '#/locales';
import { DICT_TYPE, getDictOptions } from '#/utils';

const props = defineProps<{
  orderNo?: string; // 订单号（主表的关联字段）
}>();

const emit = defineEmits<{
  /** 尺码数量汇总更新事件 */
  (e: 'update:total', total: number): void;
}>();

/** 列配置（固定 5 列：套装名称、套装编码、尺码、数量、备注） */
const COL_COUNT = 5;
/** 尺码列索引 */
const SIZE_COL_INDEX = 2;
/** 数量列索引 */
const QTY_COL_INDEX = 3;

/** 列配置（仅声明结构，字典加载由 jspreadsheet 组件根据 dictType 自动完成） */
const columns = [
  {
    title: $t('erp.orderDetail.field.setName'),
    width: 200,
    type: 'text' as const,
  },
  {
    title: $t('erp.orderDetail.field.setNumber'),
    width: 160,
    type: 'text' as const,
  },
  {
    title: $t('erp.orderDetail.field.setSize'),
    width: 140,
    type: 'dropdown' as const,
    /** 通过字典类型让 jspreadsheet 内部自动加载下拉项 */
    dictType: DICT_TYPE.ERP_SET_SIZE,
  },
  {
    title: $t('erp.orderDetail.field.setQuantity'),
    width: 140,
    type: 'numeric' as const,
  },
  {
    title: $t('erp.orderDetail.field.remark'),
    width: 200,
    type: 'text' as const,
  },
];

/** 尺码字典 value -> label 映射（用于统计卡片展示，每次取最新） */
const sizeLabelMap = new Map(
  getDictOptions(DICT_TYPE.ERP_SET_SIZE, 'string').map((opt) => [
    String(opt.value),
    opt.label,
  ]),
);

/** Jspreadsheet 实例 */
const spreadsheetRef = ref<JspreadsheetInstance | null>(null);

/** Jspreadsheet 是否已准备好 */
const isJspreadsheetReady = ref(false);

/** 当前数据（用于统计） */
const currentData = ref<any[][]>([]);

/** 触发统计刷新的版本号（数据变化时自增） */
const sizeStatsVersion = ref(0);

/** 尺码统计条目 */
interface SizeStat {
  value: string;
  label: string;
  count: number;
}

/**
 * 规范化一行数据，补齐列数（防止列数不一致导致校验错位）
 */
function normalizeRow(row: any[] | undefined, length: number): any[] {
  const result: any[] = new Array(length).fill('');
  if (row) {
    for (let i = 0; i < length; i++) {
      result[i] = row[i] ?? '';
    }
  }
  return result;
}

/**
 * 是否为空行：所有列都为空字符串/undefined/null
 */
function isEmptyRow(row: any[] | undefined): boolean {
  if (!row) return true;
  for (let i = 0; i < COL_COUNT; i++) {
    const v = row[i];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return false;
    }
  }
  return true;
}

/**
 * 是否单元格为空
 */
function isCellEmpty(v: any): boolean {
  return (
    v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
  );
}

/** 按尺码分组的数量汇总 */
const sizeStats = computed<{ list: SizeStat[]; total: number }>(() => {
  // 显式订阅版本号，外部触发更新时强制重新计算
  void sizeStatsVersion.value;

  const map = new Map<string, number>();

  // 跳过表头行（第0行），从第1行开始解析数据
  for (let i = 1; i < currentData.value.length; i++) {
    const row = normalizeRow(currentData.value[i], COL_COUNT);
    // setSize 在索引 2，setQuantity 在索引 3
    const size = row[SIZE_COL_INDEX];
    const qty = Number(row[QTY_COL_INDEX]) || 0;

    if (isCellEmpty(size)) {
      continue;
    }
    const key = String(size);
    map.set(key, (map.get(key) ?? 0) + qty);
  }

  const list: SizeStat[] = [...map.entries()]
    .map(([value, count]) => ({
      value,
      count,
      label: sizeLabelMap.get(value) ?? value,
    }))
    .sort((a, b) =>
      a.value.localeCompare(b.value, 'zh-Hans-CN', { numeric: true }),
    );

  const total = list.reduce((sum, item) => sum + item.count, 0);

  return { list, total };
});

/** 触发统计重算 */
function refreshSizeStats() {
  sizeStatsVersion.value += 1;
}

/** 总数变化时通知父组件（用于同步主表 number 字段） */
watch(
  () => sizeStats.value.total,
  (total) => {
    emit('update:total', total);
  },
  { immediate: true },
);

/** 数据变化回调：jspreadsheet 实时推送最新数据 */
function handleChange(_instance: JspreadsheetInstance, data: any[][]) {
  currentData.value = data;
  refreshSizeStats();
}

/** 加载完成回调 */
function handleLoaded(instance: JspreadsheetInstance) {
  spreadsheetRef.value = instance;
  isJspreadsheetReady.value = true;
  currentData.value = instance.getData();
  refreshSizeStats();
  // 如果有 orderNo，加载数据
  if (props.orderNo) {
    loadOrderDetails(props.orderNo);
  }
}

/** 加载订单明细 */
async function loadOrderDetails(orderNo: string) {
  const details = await getOrderDetailListByOrderNo(orderNo);
  if (spreadsheetRef.value) {
    const spreadsheetData = convertToJspreadsheetData(details);
    spreadsheetRef.value.setData(spreadsheetData);
    currentData.value = spreadsheetRef.value.getData();
  }
  refreshSizeStats();
}

/** 添加订单明细 */
function onAdd() {
  if (spreadsheetRef.value) {
    spreadsheetRef.value.insertRow();
    refreshSizeStats();
  }
}

/**
 * 把当前表格数据序列化为 Excel 友好的 Tab 分隔文本
 */
function serializeTableToClipboard(): string {
  const data = currentData.value;
  const lines: string[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    if (isEmptyRow(row)) continue;

    const sizeLabel = isCellEmpty(row[SIZE_COL_INDEX])
      ? ''
      : (sizeLabelMap.get(String(row[SIZE_COL_INDEX])) ??
        String(row[SIZE_COL_INDEX]));
    lines.push(
      [
        row[0] ?? '',
        row[1] ?? '',
        sizeLabel,
        row[QTY_COL_INDEX] ?? '',
        row[4] ?? '',
      ].join('\t'),
    );
  }
  return lines.join('\n');
}

/**
 * 将外部数据（OrderDetail[]）转换为 jspreadsheet 格式
 */
function convertToJspreadsheetData(
  orderDetails: OrderApi.OrderDetail[],
): any[][] {
  const data: any[][] = [];
  for (const detail of orderDetails) {
    data.push([
      detail.setName ?? '',
      detail.setNumber ?? '',
      detail.setSize ?? '',
      detail.setQuantity ?? '',
      detail.remark ?? '',
    ]);
  }
  return data;
}

/**
 * 将 jspreadsheet 数据转换回 OrderDetail[] 格式
 */
function convertFromJspreadsheetData(data: any[][]): OrderApi.OrderDetail[] {
  const results: OrderApi.OrderDetail[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    if (isEmptyRow(row)) continue;

    results.push({
      setName: row[0] || undefined,
      setNumber: row[1] || undefined,
      setSize: row[SIZE_COL_INDEX] || undefined,
      setQuantity: row[QTY_COL_INDEX] ? Number(row[QTY_COL_INDEX]) : undefined,
      remark: row[4] || undefined,
    } as OrderApi.OrderDetail);
  }

  return results;
}

/** 监听主表的关联字段的变化，加载对应的子表数据 */
watch(
  () => props.orderNo,
  async (val) => {
    if (!val) {
      if (spreadsheetRef.value) {
        spreadsheetRef.value.setData([]);
      }
      currentData.value = [];
      refreshSizeStats();
      return;
    }
    if (!isJspreadsheetReady.value) {
      await new Promise<void>((resolve) => {
        const unwatch = watch(
          () => isJspreadsheetReady.value,
          (ready) => {
            if (ready) {
              unwatch();
              resolve();
            }
          },
        );
      });
    }
    loadOrderDetails(val);
  },
);

/** 提供获取表格数据的方法供父组件调用 */
defineExpose({
  getData: (): OrderApi.OrderDetail[] => {
    if (!spreadsheetRef.value) return [];
    const data = spreadsheetRef.value.getData();
    return convertFromJspreadsheetData(data);
  },
  /** 校验明细：返回 true 通过；返回 false 表示校验失败 */
  validate: (): boolean => {
    // 直接从 jspreadsheet 实时读取最新数据
    const data = spreadsheetRef.value
      ? spreadsheetRef.value.getData()
      : currentData.value;
    const emptyFieldLabels: Record<number, string> = {
      [QTY_COL_INDEX]: $t('erp.orderDetail.field.setQuantity'),
      [SIZE_COL_INDEX]: $t('erp.orderDetail.field.setSize'),
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      if (isEmptyRow(row)) continue;

      if (isCellEmpty(row[SIZE_COL_INDEX])) {
        message.warn(
          $t('ui.placeholder.subTableInput', [
            i,
            emptyFieldLabels[SIZE_COL_INDEX],
          ]),
        );
        return false;
      }

      if (isCellEmpty(row[QTY_COL_INDEX]) || Number(row[QTY_COL_INDEX]) === 0) {
        message.warn(
          $t('ui.placeholder.subTableInput', [
            i,
            emptyFieldLabels[QTY_COL_INDEX],
          ]),
        );
        return false;
      }
    }
    return true;
  },
});
</script>

<template>
  <!-- 尺码统计卡片 - 只要有非空数据行就显示 -->
  <div v-if="sizeStats.list.length > 0" class="mx-4 mb-2">
    <Card size="small" class="size-stats-card">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span class="text-sm font-medium">
          {{ $t('erp.orderDetail.field.setSize') }}：
        </span>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span
            v-for="item in sizeStats.list"
            :key="item.value"
            class="border-border bg-background inline-flex items-center rounded-md border px-2 py-0.5 text-sm"
          >
            <span class="text-muted-foreground mr-1">{{ item.label }}：</span>
            <span class="font-semibold tabular-nums">{{ item.count }}</span>
          </span>
        </div>
        <span class="ml-auto inline-flex items-center text-sm">
          <span class="text-muted-foreground mr-1">
            {{ $t('erp.orderDetail.field.setQuantity') }}：
          </span>
          <span class="text-primary text-base font-semibold tabular-nums">
            {{ sizeStats.total }}
          </span>
        </span>
      </div>
    </Card>
  </div>

  <!-- Jspreadsheet 表格 -->
  <!-- Jspreadsheet 表格 -->
  <div class="mx-4">
    <Jspreadsheet
      :columns="columns"
      :data="[]"
      :min-rows="8"
      height="auto"
      @loaded="handleLoaded"
      @change="handleChange"
    />
  </div>

  <!-- 操作按钮区域 -->
  <div
    class="mx-4 mb-2 flex items-center justify-center gap-3 text-xs text-gray-500"
  >
    <Button
      :icon="h(Plus)"
      type="primary"
      ghost
      size="small"
      @click="onAdd"
      v-access:code="['erp:order:create']"
    >
      {{ $t('ui.actionTitle.create', [$t('erp.orderDetail.orderDetail')]) }}
    </Button>
  </div>
</template>

<style scoped>
/* Jspreadsheet 样式覆盖 */
:deep(.jexcel) {
  font-size: 13px;
}

:deep(.jexcel td) {
  padding: 4px 6px;
}

:deep(.jexcel th) {
  padding: 6px 8px;
  background-color: #fafafa;
}
</style>
