<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderApi } from '#/api/erp/order';

import { ref } from 'vue';

import { Page, useVbenModelDrawer } from '@vben/common-ui';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteOrder,
  deleteOrderList,
  exportOrder,
  getOrderPage,
} from '#/api/erp/order';
import { $t } from '#/locales';
import { pickSort } from '#/utils';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModalDrawer, formModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
  type: 'drawer',
});

/** 刷新表格 */
function onRefresh() {
  gridApi.query();
}

/** 创建订单信息 */
function handleCreate() {
  formModalDrawerApi.setData({}).open();
}

/** 编辑订单信息 */
function handleEdit(row: OrderApi.Order) {
  formModalDrawerApi.setData(row).open();
}

/** 删除订单信息 */
async function handleDelete(row: OrderApi.Order) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.id]),
    key: 'action_key_msg',
  });
  try {
    await deleteOrder(row.id as number);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.id]),
      key: 'action_key_msg',
    });
    onRefresh();
  } finally {
    hideLoading();
  }
}

/** 批量删除订单信息 */
async function handleDeleteBatch() {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    key: 'action_key_msg',
  });
  try {
    await deleteOrderList(checkedIds.value);
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
function handleRowCheckboxChange({ records }: { records: OrderApi.Order[] }) {
  checkedIds.value = records.map((item) => item.id);
}

/** 导出订单信息 */
const exportLoading = ref(false);
async function handleExport() {
  try {
    exportLoading.value = true;
    message.loading({
      content: $t('ui.actionMessage.exporting'),
      key: 'action_key_msg',
    });
    const data = await exportOrder(await gridApi.formApi.getValues());
    downloadFileFromBlobPart({
      fileName: `${$t('erp.order.order')}.xls`,
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
          return await getOrderPage({
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
  } as VxeTableGridOptions<OrderApi.Order>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    sortChange: () => gridApi.query(),
  },
});
</script>

<template>
  <Page auto-content-height>
    <FormModalDrawer @success="onRefresh" />

    <Grid :table-title="$t('erp.order.order')">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', [$t('erp.order.order')]),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:order:create'],
              onClick: handleCreate,
            },
            {
              label: $t('ui.actionTitle.export', [$t('erp.order.order')]),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:order:export'],
              onClick: handleExport,
              loading: exportLoading,
            },
            {
              label: $t('ui.actionTitle.deleteBatch', [$t('erp.order.order')]),
              type: 'primary',
              danger: true,
              icon: ACTION_ICON.DELETE,
              disabled: isEmpty(checkedIds),
              auth: ['erp:order:delete'],
              onClick: handleDeleteBatch,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['erp:order:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:order:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [
                  row.id,
                  $t('erp.order.order'),
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
