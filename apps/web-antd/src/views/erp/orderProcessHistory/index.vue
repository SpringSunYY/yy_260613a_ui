<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderProcessHistoryApi } from '#/api/erp/orderProcessHistory';

import { ref } from 'vue';

import { Page, useVbenModelDrawer } from '@vben/common-ui';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteOrderProcessHistory,
  deleteOrderProcessHistoryList,
  exportOrderProcessHistory,
  getOrderProcessHistoryPage,
} from '#/api/erp/orderProcessHistory';
import { $t } from '#/locales';
import { pickSort } from '#/utils';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModalDrawer, formModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
  type: 'drawer',
  externalCloseConfirm: false,
});

/** 刷新表格 */
function onRefresh() {
  gridApi.query();
}

/** 创建订单工序记录 */
function handleCreate() {
  formModalDrawerApi.setData({}).open();
}

/** 编辑订单工序记录 */
function handleView(row: OrderProcessHistoryApi.OrderProcessHistory) {
  formModalDrawerApi.setData(row).open();
}

/** 删除订单工序记录 */
async function handleDelete(row: OrderProcessHistoryApi.OrderProcessHistory) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.id]),
    key: 'action_key_msg',
  });
  try {
    await deleteOrderProcessHistory(row.id as number);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.id]),
      key: 'action_key_msg',
    });
    onRefresh();
  } finally {
    hideLoading();
  }
}

/** 批量删除订单工序记录 */
async function handleDeleteBatch() {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    key: 'action_key_msg',
  });
  try {
    await deleteOrderProcessHistoryList(checkedIds.value);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess'),
      key: 'action_key_msg',
    });
    onRefresh();
  } finally {
    hideLoading();
  }
}

const checkedIds = ref<number[]>([]);
function handleRowCheckboxChange({
  records,
}: {
  records: OrderProcessHistoryApi.OrderProcessHistory[];
}) {
  checkedIds.value = records.map((item) => item.id);
}

/** 导出订单工序记录 */
const exportLoading = ref(false);
async function handleExport() {
  try {
    exportLoading.value = true;
    message.loading({
      content: $t('ui.actionMessage.exporting'),
      key: 'action_key_msg',
    });
    const data = await exportOrderProcessHistory(
      await gridApi.formApi.getValues(),
    );
    downloadFileFromBlobPart({
      fileName: `${$t('erp.orderProcessHistory.orderProcessHistory')}.xls`,
      source: data,
    });
  } finally {
    exportLoading.value = false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    pagerConfig: {
      enabled: true,
    },
    proxyConfig: {
      ajax: {
        query: async (ctx, formValues) => {
          const { page } = ctx || {};
          const { sortBy, sort } = pickSort(ctx);
          return await getOrderProcessHistoryPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...(sortBy?.length ? { sortBy, sort } : {}),
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    toolbarConfig: {
      refresh: { code: 'query' },
      search: true,
    },
    sortConfig: {
      remote: true,
      multiple: true,
    },
  } as VxeTableGridOptions<OrderProcessHistoryApi.OrderProcessHistory>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    sortChange: () => gridApi.query(),
  },
});
</script>

<template>
  <Page auto-content-height>
    <FormModalDrawer />

    <Grid :table-title="$t('erp.orderProcessHistory.orderProcessHistory')">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            /*    {
              label: $t('ui.actionTitle.create', [
                $t('erp.orderProcessHistory.orderProcessHistory'),
              ]),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:order-process-history:create'],
              onClick: handleCreate,
            },*/
            {
              label: $t('ui.actionTitle.export', [
                $t('erp.orderProcessHistory.orderProcessHistory'),
              ]),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:order-process-history:export'],
              onClick: handleExport,
              loading: exportLoading,
            },
            {
              label: $t('ui.actionTitle.deleteBatch', [
                $t('erp.orderProcessHistory.orderProcessHistory'),
              ]),
              type: 'primary',
              danger: true,
              icon: ACTION_ICON.DELETE,
              disabled: isEmpty(checkedIds),
              auth: ['erp:order-process-history:delete'],
              onClick: handleDeleteBatch,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.view'),
              type: 'link',
              icon: ACTION_ICON.VIEW,
              auth: ['erp:order-process-history:search'],
              onClick: handleView.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:order-process-history:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [
                  row.id,
                  $t('erp.orderProcessHistory.orderProcessHistory'),
                ]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
