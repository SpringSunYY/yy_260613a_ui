<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { ref } from 'vue';

import { Page, useVbenModelDrawer } from '@vben/common-ui';
import {
  downloadFileFromBlobPart,
  formatTime,
  getCurrentTime,
  isEmpty,
} from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteOrderProcess,
  deleteOrderProcessList,
  exportOrderProcess,
  getOrderProcessPage,
  updateProcessToTargetProcess,
} from '#/api/erp/orderProcess';
import I18nDictTag from '#/components/i18n/i18n-dict-tag/i18n-dict-tag.vue';
import { $t } from '#/locales';
import { DICT_TYPE, ErpOrderCurrentProcess, pickSort } from '#/utils';
import ShipForm from '#/views/erp/ship/modules/ship-form.vue';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModalDrawer, formModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
  type: 'drawer',
});

const [ShipFormModalDrawer, shipFormModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: ShipForm,
  destroyOnClose: true,
  type: 'modal',
});

/** 刷新表格 */
function onRefresh() {
  gridApi.query();
}

/** 创建订单工序 */
function handleCreate() {
  formModalDrawerApi.setData({}).open();
}

/** 编辑订单工序 */
function handleEdit(row: OrderProcessApi.OrderProcess) {
  formModalDrawerApi.setData(row).open();
}

const processActionConfig = [
  {
    current: ErpOrderCurrentProcess.CURRENT_PROCESS_2,
    target: ErpOrderCurrentProcess.CURRENT_PROCESS_3,
    label: 'erp.orderProcess.action.layout',
    auth: 'erp:order-process:layout',
  },
  {
    current: ErpOrderCurrentProcess.CURRENT_PROCESS_3,
    target: ErpOrderCurrentProcess.CURRENT_PROCESS_4,
    label: 'erp.orderProcess.action.paper',
    auth: 'erp:order-process:paper',
  },
  {
    current: ErpOrderCurrentProcess.CURRENT_PROCESS_4,
    target: ErpOrderCurrentProcess.CURRENT_PROCESS_5,
    label: 'erp.orderProcess.action.roller',
    auth: 'erp:order-process:roller',
  },
  {
    current: ErpOrderCurrentProcess.CURRENT_PROCESS_5,
    target: ErpOrderCurrentProcess.CURRENT_PROCESS_6,
    label: 'erp.orderProcess.action.laser',
    auth: 'erp:order-process:laser',
  },
  {
    current: ErpOrderCurrentProcess.CURRENT_PROCESS_6,
    target: ErpOrderCurrentProcess.CURRENT_PROCESS_7,
    label: 'erp.orderProcess.action.ship',
    auth: 'erp:order-process:ship',
  },
] as const;

/** 推进订单工序 */
async function handleToTargetProcess(
  row: OrderProcessApi.OrderProcess,
  targetProcess: string,
) {
  await updateProcessToTargetProcess({
    id: row.id,
    currentProcess: targetProcess,
    orderNo: row.orderNo,
    layoutPerson: row.layoutPerson,
  });
  message.success($t('ui.actionMessage.operationSuccess'));
  onRefresh();
}

/** 发货 */
function handleOrderShip(row: OrderProcessApi.OrderProcess) {
  if (!row.orderNo) return;
  shipFormModalDrawerApi.setData(row).open();
}

/** 根据当前工序生成“更多”中的推进操作 */
function getProcessDropDownActions(row: OrderProcessApi.OrderProcess) {
  return processActionConfig.map((action) => ({
    label: $t(action.label),
    type: 'link' as const,
    auth: [action.auth],
    ifShow: row.currentProcess === action.current,
    ...(action.target === ErpOrderCurrentProcess.CURRENT_PROCESS_7
      ? { onClick: handleOrderShip.bind(null, row) }
      : {
          popConfirm: {
            title: row.orderNo
              ? $t('erp.orderProcess.actionMessage.advanceConfirm', [
                  row.orderNo,
                ])
              : $t('ui.actionMessage.submitConfirm'),
            confirm: handleToTargetProcess.bind(null, row, action.target),
          },
        }),
  }));
}

/** 删除订单工序 */
async function handleDelete(row: OrderProcessApi.OrderProcess) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.id]),
    key: 'action_key_msg',
  });
  try {
    await deleteOrderProcess(row.id as number);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.id]),
      key: 'action_key_msg',
    });
    onRefresh();
  } finally {
    hideLoading();
  }
}

/** 批量删除订单工序 */
async function handleDeleteBatch() {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    key: 'action_key_msg',
  });
  try {
    await deleteOrderProcessList(checkedIds.value);
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
  records: OrderProcessApi.OrderProcess[];
}) {
  checkedIds.value = records.map((item) => item.id);
}

/** 导出订单工序 */
const exportLoading = ref(false);
async function handleExport() {
  try {
    exportLoading.value = true;
    message.loading({
      content: $t('ui.actionMessage.exporting'),
      key: 'action_key_msg',
    });
    const data = await exportOrderProcess(await gridApi.formApi.getValues());
    downloadFileFromBlobPart({
      fileName: `${$t('erp.orderProcess.orderProcess')}${getCurrentTime()}.xls`,
      source: data,
    });
  } catch (error: any) {
    message.error({
      content:
        error?.response?.msg || error?.msg || error?.message || '导出失败',
      key: 'action_key_msg',
      duration: 3,
    });
  } finally {
    exportLoading.value = false;
  }
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
          return await getOrderProcessPage({
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
    },
    cellConfig: {
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
  } as VxeTableGridOptions<OrderProcessApi.OrderProcess>,
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
    <ShipFormModalDrawer @success="onRefresh" />

    <Grid :table-title="$t('erp.orderProcess.orderProcess')">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            /* {
              label: $t('ui.actionTitle.create', [
                $t('erp.orderProcess.orderProcess'),
              ]),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:order-process:create'],
              onClick: handleCreate,
            },*/
            {
              label: $t('ui.actionTitle.export', [
                $t('erp.orderProcess.orderProcess'),
              ]),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:order-process:export'],
              onClick: handleExport,
              loading: exportLoading,
            },
            {
              label: $t('ui.actionTitle.deleteBatch', [
                $t('erp.orderProcess.orderProcess'),
              ]),
              type: 'primary',
              danger: true,
              icon: ACTION_ICON.DELETE,
              disabled: isEmpty(checkedIds),
              auth: ['erp:order-process:delete'],
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
              auth: ['erp:order-process:update'],
              onClick: handleEdit.bind(null, row),
            },
            ...getProcessDropDownActions(row),
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:order-process:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [
                  row.id,
                  $t('erp.orderProcess.orderProcess'),
                ]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
      <template #serialNumber="{ rowIndex }">
        {{ rowIndex + 1 }}
      </template>
      <template #orderStatus="{ row }">
        <div>
          <div>
            <I18nDictTag
              :type="DICT_TYPE.ERP_ORDER_STATUS"
              :value="row.orderStatus"
            />
          </div>
          <div>
            {{ formatTime(row.exceptShippingTime, 'yyyy-MM-dd') }}
          </div>
        </div>
      </template>
      <template #specification="{ row }">
        <div class="flex items-center">
          <div>
            <I18nDictTag
              :type="DICT_TYPE.ERP_SPECIFICATION"
              :value="row.specification"
            />
          </div>
          <div>{{ row.number }}套</div>
        </div>
      </template>
    </Grid>
  </Page>
</template>
