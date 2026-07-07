<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderAuditApi } from '#/api/erp/orderAudit';

import { Page, useVbenModelDrawer, useVbenModal } from '@vben/common-ui';
import { message,Tabs } from 'ant-design-vue';
import Form from './modules/form.vue';


import { ref, computed } from 'vue';
import { $t } from '#/locales';
import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { pickSort } from '#/utils';
import { getOrderAuditPage, deleteOrderAudit, deleteOrderAuditList, exportOrderAudit } from '#/api/erp/orderAudit';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { useGridColumns, useGridFormSchema } from './data';


const [FormModalDrawer, formModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
  type: 'drawer'
});



/** 刷新表格 */
function onRefresh() {
  gridApi.query();
}

/** 创建订单审核记录 */
function handleCreate() {
  formModalDrawerApi.setData({}).open();
}

/** 编辑订单审核记录 */
function handleEdit(row: OrderAuditApi.OrderAudit) {
  formModalDrawerApi.setData(row).open();
}


/** 删除订单审核记录 */
async function handleDelete(row: OrderAuditApi.OrderAudit) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.id]),
    key: 'action_key_msg'
  });
  try {
    await deleteOrderAudit(row.id as number);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.id]),
      key: 'action_key_msg',
    });
    onRefresh();
  } finally {
    hideLoading();
  }
}

/** 批量删除订单审核记录 */
async function handleDeleteBatch() {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    key: 'action_key_msg'
  });
  try {
    await deleteOrderAuditList(checkedIds.value);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess'),
      key: 'action_key_msg',
    });
    onRefresh();
  } finally {
    hideLoading();
  }
}

const checkedIds = ref<number[]>([])
function handleRowCheckboxChange({
  records
}: {
  records: OrderAuditApi.OrderAudit[];
}) {
  checkedIds.value = records.map((item) => item.id);
}

/** 导出订单审核记录 */
const exportLoading = ref(false);
async function handleExport() {
    try {
      exportLoading.value = true;
      message.loading({
        content: $t('ui.actionMessage.exporting'),
        key: 'action_key_msg',
      });
      const data = await exportOrderAudit(await gridApi.formApi.getValues());
      downloadFileFromBlobPart({ fileName: $t('erp.orderAudit.orderAudit') + '.xls', source: data });
    }finally {
      exportLoading.value = false;
    }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema()
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
          return await getOrderAuditPage({
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
    }
  } as VxeTableGridOptions<OrderAuditApi.OrderAudit>,
  gridEvents:{
      checkboxAll: handleRowCheckboxChange,
      checkboxChange: handleRowCheckboxChange,
    sortChange: () => gridApi.query()
  }
});
</script>

<template>
  <Page auto-content-height>
    <FormModalDrawer @success="onRefresh" />
    
    <Grid :table-title="$t('erp.orderAudit.orderAudit')" >
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', [$t('erp.orderAudit.orderAudit')]),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:order-audit:create'],
              onClick: handleCreate,
            },
            {
              label: $t('ui.actionTitle.export', [$t('erp.orderAudit.orderAudit')]),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:order-audit:export'],
              onClick: handleExport,
              loading: exportLoading,
            },
            {
              label: $t('ui.actionTitle.deleteBatch', [$t('erp.orderAudit.orderAudit')]),
              type: 'primary',
              danger: true,
              icon: ACTION_ICON.DELETE,
              disabled: isEmpty(checkedIds),
              auth: ['erp:order-audit:delete'],
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
              auth: ['erp:order-audit:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:order-audit:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.id, $t('erp.orderAudit.orderAudit')]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>

  </Page>
</template>