<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderVectorApi } from '#/api/erp/orderVector';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModelDrawer } from '@vben/common-ui';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteOrderVector,
  deleteOrderVectorList,
  exportOrderVector,
  getOrderVectorPage,
} from '#/api/erp/orderVector';
import { $t } from '#/locales';
import { pickSort } from '#/utils';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const router = useRouter();

const [FormModalDrawer, formModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
  type: 'modal',
  externalCloseConfirm: false,
});

/** 刷新表格 */
function onRefresh() {
  gridApi.query();
}

/** 创建订单向量 */
function handleCreate() {
  formModalDrawerApi.setData({}).open();
}

/** 编辑订单向量 */
function handleView(row: OrderVectorApi.OrderVector) {
  formModalDrawerApi.setData(row).open();
}

/**
 * 按行内向量编号触发"以图搜图"。
 * <p>这里走页面跳转（不是 modal），把 {@code vectorId} 通过 query string
 * 透传给 {@link ./search/index.vue}，搜索页面进入时会立刻搜一次，
 * 命中的图片作为左侧默认预览图（与 infra/vector/image 的 modal 行为对齐）。
 */
function handleSearchByRow(row: OrderVectorApi.OrderVector) {
  if (!row.vectorId) {
    message.warning($t('erp.orderVector.message.searchEmpty'));
    return;
  }
  router.push({
    name: 'OrderVectorSearch',
    query: { vectorId: row.vectorId },
  });
}

/** 删除订单向量 */
async function handleDelete(row: OrderVectorApi.OrderVector) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.id]),
    key: 'action_key_msg',
  });
  try {
    await deleteOrderVector(row.id as number);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.id]),
      key: 'action_key_msg',
    });
    onRefresh();
  } finally {
    hideLoading();
  }
}

/** 批量删除订单向量 */
async function handleDeleteBatch() {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    key: 'action_key_msg',
  });
  try {
    await deleteOrderVectorList(checkedIds.value);
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
  records: OrderVectorApi.OrderVector[];
}) {
  checkedIds.value = records.map((item) => item.id);
}

/** 导出订单向量 */
const exportLoading = ref(false);
async function handleExport() {
  try {
    exportLoading.value = true;
    message.loading({
      content: $t('ui.actionMessage.exporting'),
      key: 'action_key_msg',
    });
    const data = await exportOrderVector(await gridApi.formApi.getValues());
    downloadFileFromBlobPart({
      fileName: `${$t('erp.orderVector.orderVector')}.xls`,
      source: data,
    });
  } finally {
    exportLoading.value = false;
  }
}

/** 进入以图搜图页面（上传图搜索模式） */
function handleSearch() {
  router.push('/erp/order-vector/search');
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    collapsed: true,
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
          return await getOrderVectorPage({
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
      height: 80,
    },
    toolbarConfig: {
      refresh: { code: 'query' },
      search: true,
    },
    sortConfig: {
      remote: true,
      multiple: true,
    },
  } as VxeTableGridOptions<OrderVectorApi.OrderVector>,
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

    <Grid :table-title="$t('erp.orderVector.orderVector')">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('erp.orderVector.action.search'),
              type: 'primary',
              icon: ACTION_ICON.SEARCH,
              auth: ['erp:order-vector:query'],
              onClick: handleSearch,
            },
            /*  {
              label: $t('ui.actionTitle.create', [
                $t('erp.orderVector.orderVector'),
              ]),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:order-vector:create'],
              onClick: handleCreate,
            },*/
            {
              label: $t('ui.actionTitle.export', [
                $t('erp.orderVector.orderVector'),
              ]),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:order-vector:export'],
              onClick: handleExport,
              loading: exportLoading,
            },
            {
              label: $t('ui.actionTitle.deleteBatch', [
                $t('erp.orderVector.orderVector'),
              ]),
              type: 'primary',
              danger: true,
              icon: ACTION_ICON.DELETE,
              disabled: isEmpty(checkedIds),
              auth: ['erp:order-vector:delete'],
              onClick: handleDeleteBatch,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('erp.orderVector.action.searchById'),
              type: 'link',
              icon: ACTION_ICON.SEARCH,
              auth: ['erp:order-vector:query'],
              onClick: handleSearchByRow.bind(null, row),
            },
            {
              label: $t('common.view'),
              type: 'link',
              icon: ACTION_ICON.VIEW,
              auth: ['erp:order-vector:query'],
              onClick: handleView.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:order-vector:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [
                  row.id,
                  $t('erp.orderVector.orderVector'),
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
