<script lang="ts" setup>
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { OrderApi } from '#/api/erp/order';

import { computed, h, nextTick, ref, watch } from 'vue';

import { Plus } from '@vben/icons';

import { Button, Card, Input, message, Select } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getOrderDetailListByOrderNo } from '#/api/erp/order';
import { $t } from '#/locales';
import { DICT_TYPE, getDictOptions } from '#/utils';

import { useOrderDetailGridEditColumns } from '../data';

const props = defineProps<{
  orderNo?: string; // 订单号（主表的关联字段）
}>();

const emit = defineEmits<{
  /** 尺码数量汇总更新事件 */
  (e: 'update:total', total: number): void;
}>();

/** 尺码字典选项（用于 label 展示） */
const sizeOptions = getDictOptions(DICT_TYPE.ERP_SET_SIZE, 'string');
const sizeLabelMap = new Map(
  sizeOptions.map((opt) => [String(opt.value), opt.label]),
);

/** 触发统计刷新的版本号（数据变化时自增） */
const sizeStatsVersion = ref(0);
/** 尺码统计条目 */
interface SizeStat {
  value: string;
  label: string;
  count: number;
}

/** 表格操作按钮的回调函数 */
function onActionClick({
  code,
  row,
}: OnActionClickParams<OrderApi.OrderDetail>) {
  switch (code) {
    case 'delete': {
      onDelete(row);
      break;
    }
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useOrderDetailGridEditColumns(onActionClick),
    border: true,
    showOverflow: true,
    autoResize: true,
    keepSource: true,
    rowConfig: {
      keyField: 'id',
    },
    pagerConfig: {
      enabled: false,
    },
    toolbarConfig: {
      enabled: false,
    },
  },
  gridEvents: {
    // 单元格编辑结束时（setSize / setQuantity）刷新统计
    editClosed: () => refreshSizeStats(),
  },
});

/** 按尺码分组的数量汇总（必须在 gridApi 声明之后定义） */
const sizeStats = computed<{ list: SizeStat[]; total: number }>(() => {
  // 显式订阅版本号，使外部触发更新时本计算属性重新计算
  void sizeStatsVersion.value;
  // 使用 fullData 拿到所有行（含新增/未挂载的），
  // 避免 getData() 在编辑中只返回当前可见数据导致只算到第一行
  const fullData = gridApi.grid.getTableData?.().fullData as
    | OrderApi.OrderDetail[]
    | undefined;
  const data = fullData ?? gridApi.grid.getData?.() ?? [];
  const map = new Map<string, number>();
  for (const row of data) {
    const size = (row as any).setSize;
    if (size === undefined || size === null || size === '') {
      continue;
    }
    const qty = Number((row as any).setQuantity) || 0;
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

/** 添加订单明细 */
const onAdd = async () => {
  await gridApi.grid.insertAt({} as OrderApi.OrderDetail, -1);
  refreshSizeStats();
};

/** 删除订单明细 */
const onDelete = async (row: OrderApi.OrderDetail) => {
  await gridApi.grid.remove(row);
  refreshSizeStats();
};

/** 提供获取表格数据的方法供父组件调用 */
defineExpose({
  getData: (): OrderApi.OrderDetail[] => {
    const data = gridApi.grid.getData() as OrderApi.OrderDetail[];
    const removeRecords =
      gridApi.grid.getRemoveRecords() as OrderApi.OrderDetail[];
    const insertRecords =
      gridApi.grid.getInsertRecords() as OrderApi.OrderDetail[];
    return data
      .filter((row) => !removeRecords.some((removed) => removed.id === row.id))
      ?.concat(insertRecords.map((row: any) => ({ ...row, id: undefined })));
  },
  /** 校验明细：返回 true 通过；返回 string[] 所有未通过的错误信息 */
  validate: (): boolean => {
    // 同时取全量数据 + 当前数据,确保即便有删除/未挂载的行也能覆盖
    const data =
      (gridApi.grid.getTableData?.().fullData as OrderApi.OrderDetail[]) ||
      (gridApi.grid.getData() as OrderApi.OrderDetail[]);
    const emptyFieldLabels: Record<string, string> = {
      setQuantity: $t('erp.orderDetail.field.setQuantity'),
      setSize: $t('erp.orderDetail.field.setSize'),
    };
    for (const [i, row] of data.entries()) {
      for (const [field, label] of Object.entries(emptyFieldLabels)) {
        const value = (row as any)[field];
        if (value === undefined || value === null || value === '') {
          message.warn($t('ui.placeholder.subTableInput', [i + 1, label]));
          return false;
        }
      }
    }
    return true;
  },
});

/** 监听主表的关联字段的变化，加载对应的子表数据 */
watch(
  () => props.orderNo,
  async (val) => {
    if (!val) {
      return;
    }
    await nextTick();
    await gridApi.grid.loadData(
      await getOrderDetailListByOrderNo(props.orderNo!),
    );
    refreshSizeStats();
  },
  { immediate: true },
);
</script>

<template>
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
  <Grid class="mx-4">
    <template #serialNumber="{ rowIndex }">
      {{ rowIndex + 1 }}
    </template>
    <template #setName="{ row }">
      <Input v-model:value="row.setName" />
    </template>
    <template #setNumber="{ row }">
      <Input v-model:value="row.setNumber" />
    </template>
    <template #setQuantity="{ row }">
      <a-input-number
        :min="1"
        v-model:value="row.setQuantity"
        @change="refreshSizeStats()"
      />
    </template>
    <template #setSize="{ row, column }">
      <Select
        v-model:value="row.setSize"
        class="w-full"
        @change="refreshSizeStats()"
      >
        <Select.Option
          v-for="option in column.params.options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </Select.Option>
      </Select>
    </template>
    <template #remark="{ row }">
      <Input v-model:value="row.remark" />
    </template>
  </Grid>
  <div class="-mt-4 flex justify-center">
    <Button
      :icon="h(Plus)"
      type="primary"
      ghost
      @click="onAdd"
      v-access:code="['erp:order:create']"
    >
      {{ $t('ui.actionTitle.create', [$t('erp.orderDetail.orderDetail')]) }}
    </Button>
  </div>
</template>
