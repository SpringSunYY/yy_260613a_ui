<script lang="ts" setup>
import type { OrderApi } from '#/api/erp/order';

import { computed, nextTick, ref, watch } from 'vue';

import { Card, Input } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getOrderDetailListByOrderNo } from '#/api/erp/order';
import I18nDictTag from '#/components/i18n/i18n-dict-tag/i18n-dict-tag.vue';
import { $t } from '#/locales';
import { DICT_TYPE, getDictOptions } from '#/utils';

import { useOrderDetailGridViewColumns } from '../data';

const props = defineProps<{
  orderNo?: string; // 订单号（主表的关联字段）
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

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useOrderDetailGridViewColumns(),
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
    <template #setName="{ row }">
      <Input :readonly="true" v-model:value="row.setName" />
    </template>
    <template #setNumber="{ row }">
      <Input :readonly="true" v-model:value="row.setNumber" />
    </template>
    <template #setQuantity="{ row }">
      <a-input-number
        :min="1"
        :readonly="true"
        v-model:value="row.setQuantity"
        @change="refreshSizeStats()"
      />
    </template>
    <template #setSize="{ row }">
      <I18nDictTag :type="DICT_TYPE.ERP_SET_SIZE" :value="row.setSize" />
    </template>
    <template #remark="{ row }">
      <Input :readonly="true" v-model:value="row.remark" />
    </template>
  </Grid>
</template>
