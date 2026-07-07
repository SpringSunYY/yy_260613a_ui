<script lang="ts" setup>
import type { OnActionClickParams } from '#/adapter/vxe-table';
import type { OrderApi } from '#/api/erp/order';

import { h, nextTick, watch } from 'vue';

import { Plus } from '@vben/icons';

import { Button, Input, Select } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getOrderDetailListByOrderNo } from '#/api/erp/order';
import { $t } from '#/locales';

import { useOrderDetailGridEditColumns } from '../data';

const props = defineProps<{
  orderNo?: string; // 订单号（主表的关联字段）
}>();

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
});

/** 添加订单明细 */
const onAdd = async () => {
  await gridApi.grid.insertAt({} as OrderApi.OrderDetail, -1);
};

/** 删除订单明细 */
const onDelete = async (row: OrderApi.OrderDetail) => {
  await gridApi.grid.remove(row);
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
  },
  { immediate: true },
);
</script>

<template>
  <Grid class="mx-4">
    <template #setName="{ row }">
      <Input v-model:value="row.setName" />
    </template>
    <template #setNumber="{ row }">
      <Input v-model:value="row.setNumber" />
    </template>
    <template #setQuantity="{ row }">
      <Input type="number" v-model:value="row.setQuantity" />
    </template>
    <template #setSize="{ row, column }">
      <Select v-model:value="row.setSize" class="w-full">
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
