<script lang="ts" setup>
import type { PageParam } from '@vben/request';

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
  getOrder,
  getOrderLoanStatistics,
  getOrderPage,
  getOrderPostageStatistics,
  getOrderStatistics,
  submitAuditOrder,
} from '#/api/erp/order';
import { getOrderProcessByOrderNo } from '#/api/erp/orderProcess';
import { resetOrderVector } from '#/api/erp/orderVector';
import I18nDictTag from '#/components/i18n/i18n-dict-tag/i18n-dict-tag.vue';
import { $t } from '#/locales';
import {
  DICT_TYPE,
  ErpOrderAuditStatus,
  ErpOrderCurrentProcess,
  pickSort,
} from '#/utils';
import FormView from '#/views/erp/order/modules/form-view.vue';
import PrintForm from '#/views/erp/order/modules/print-form.vue';
import ShipForm from '#/views/erp/ship/modules/ship-form.vue';

import { useGridColumns, useGridFormSchema } from './data';
import AuditForm from './modules/audit-form.vue';
import Form from './modules/form.vue';

const [FormModalDrawer, formModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
  type: 'drawer',
});
const [ViewFormModalDrawer, viewFormModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: FormView,
  destroyOnClose: true,
  type: 'drawer',
  externalCloseConfirm: false,
});

const [PrintFormModalDrawer, printFormModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: PrintForm,
  destroyOnClose: true,
  type: 'modal',
  externalCloseConfirm: false,
});
/** 打印*/
function handleOrderPrint(row: OrderApi.Order) {
  if (!row.orderNo) return;
  printFormModalDrawerApi.setData({ orderNo: row.orderNo }).open();
}

/** 发货*/
const [ShipFormModalDrawer, shipFormModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: ShipForm,
  destroyOnClose: true,
  type: 'modal',
});
async function handleOrderShip(row: OrderApi.Order) {
  if (!row.orderNo) return;
  // 先查询一遍订单工序
  const data = await getOrderProcessByOrderNo(row.orderNo);
  shipFormModalDrawerApi.setData(data).open();
}

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

/** 复制订单信息（用于快捷新增） */
async function handleCopy(row: OrderApi.Order) {
  // 获取完整数据
  const data = await getOrder(row.id);
  // 打开新增表单，传递数据和复制标志
  formModalDrawerApi
    .setData({
      ...data,
      isCopy: true, // 复制标志
    })
    .open();
}

/** 查看订单信息 */
function handleView(row: OrderApi.Order) {
  viewFormModalDrawerApi.setData(row).open();
}

const orderResetVectorLoading = ref(false);
/** 重置向量*/
async function handleOrderResetVector(row: OrderApi.Order) {
  if (!row.orderNo) return;
  orderResetVectorLoading.value = true;
  await resetOrderVector(row);
  orderResetVectorLoading.value = false;
  message.success($t('ui.actionMessage.operationSuccess'));
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

/** 提交审核 */
async function handleSubmitAudit(row: OrderApi.Order) {
  // 根据订单no更新至待审核
  await submitAuditOrder(row);
  onRefresh();
}

const [AuditFormModalDrawer, auditFormModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: AuditForm,
  destroyOnClose: true,
  type: 'modal',
});

/** 审核*/
function handleApproveAudit(row: OrderApi.Order) {
  auditFormModalDrawerApi.setData(row).open();
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

const statisticsData = ref<OrderApi.OrderStatistics[]>();
const totalCount = ref<number>(0);
const loanStatisticsData = ref<OrderApi.OrderStatistics[]>();
const loanTotalCount = ref<number>(0);
const postageStatisticsData = ref<OrderApi.OrderStatistics[]>();
const postageTotalCount = ref<number>(0);

function getStatistics(formValues: PageParam) {
  // 获取统计
  getOrderStatistics(formValues).then((res) => {
    if (!res || res?.length <= 0) return;
    statisticsData.value = res;
    totalCount.value = 0;
    res.forEach((item) => (totalCount.value += Number(item.total)));
  });
  // 获取贷款
  getOrderLoanStatistics(formValues).then((res) => {
    if (!res || res?.length <= 0) return;
    loanStatisticsData.value = res;
    loanTotalCount.value = 0;
    res.forEach((item) => (loanTotalCount.value += Number(item.total)));
  });
  //  获取邮费
  getOrderPostageStatistics(formValues).then((res) => {
    if (!res || res?.length <= 0) return;
    postageStatisticsData.value = res;
    postageTotalCount.value = 0;
    res.forEach((item) => (postageTotalCount.value += Number(item.total)));
  });
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
          getStatistics(formValues);
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
    <ViewFormModalDrawer />
    <ShipFormModalDrawer @success="onRefresh" />
    <AuditFormModalDrawer @success="onRefresh" />
    <PrintFormModalDrawer @success="onRefresh" />
    <Grid>
      <template #table-title>
        <div class="flex flex-col gap-y-2">
          <div class="flex items-center gap-x-4">
            <span><a-tag>总计</a-tag>：{{ totalCount }}</span>
            <span
              v-for="item in statisticsData"
              :key="item.name"
              class="inline-flex items-center"
            >
              <I18nDictTag
                :type="DICT_TYPE.ERP_SPECIFICATION"
                :value="item.name"
              />
              ：<span class="text-primary">{{ item.total }}</span>
            </span>
          </div>
          <div class="flex items-center gap-x-4">
            <span>
              <a-tag>贷款总计</a-tag>
              ：{{ loanTotalCount?.toFixed(2) }}
            </span>
            <span
              v-for="item in loanStatisticsData"
              :key="item.name"
              class="inline-flex items-center"
            >
              <I18nDictTag
                :type="DICT_TYPE.ERP_LOAN_STATUS"
                :value="item.name"
              />
              ：<span class="text-primary">{{ item.total }}</span>
            </span>
          </div>
          <div class="flex items-center gap-x-4">
            <span>
              <a-tag>邮费总计</a-tag>
              ：{{ postageTotalCount?.toFixed(2) }}
            </span>
            <span
              v-for="item in postageStatisticsData"
              :key="item.name"
              class="inline-flex items-center"
            >
              <I18nDictTag
                :type="DICT_TYPE.ERP_POSTAGE_STATUS"
                :value="item.name"
              />
              ：<span class="text-primary">{{ item.total }}</span>
            </span>
          </div>
        </div>
      </template>

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
              label: $t('common.view'),
              type: 'link',
              icon: ACTION_ICON.VIEW,
              auth: ['erp:order:query'],
              onClick: handleView.bind(null, row),
            },
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['erp:order:update'],
              onClick: handleEdit.bind(null, row),
            },
          ]"
          :drop-down-actions="[
            {
              label: $t('common.submit'),
              type: 'link',
              auth: ['erp:order:create'],
              ifShow:
                row.auditStatus === ErpOrderAuditStatus.ORDER_AUDIT_STATUS_1,
              popConfirm: {
                title: $t('ui.actionMessage.submitConfirm', [
                  row.orderNo,
                  $t('erp.order.order'),
                ]),
                confirm: handleSubmitAudit.bind(null, row),
              },
            },
            {
              label: $t('common.approve'),
              type: 'link',
              auth: ['erp:order-audit:create'],
              ifShow:
                row.auditStatus !== ErpOrderAuditStatus.ORDER_AUDIT_STATUS_1 &&
                row.auditStatus !== ErpOrderAuditStatus.ORDER_AUDIT_STATUS_3,
              onClick: handleApproveAudit.bind(null, row),
            },
            //发货
            {
              label: $t('erp.orderProcess.action.ship'),
              type: 'link',
              auth: [
                'erp.orderProcess.action.ship',
                'erp:order-process:complete',
              ],
              ifShow:
                row.auditStatus === ErpOrderAuditStatus.ORDER_AUDIT_STATUS_3 &&
                (row.currentProcess ===
                  ErpOrderCurrentProcess.CURRENT_PROCESS_6 ||
                  row.currentProcess ===
                    ErpOrderCurrentProcess.CURRENT_PROCESS_7),
              onClick: handleOrderShip.bind(null, row),
            },
            //发货
            {
              label: $t('common.print'),
              type: 'link',
              icon: ACTION_ICON.PRINT,
              auth: [
                'erp.orderProcess.action.ship',
                'erp:order-process:complete',
              ],
              onClick: handleOrderPrint.bind(null, row),
            },
            //重置向量
            {
              label: $t('erp.orderVector.orderVector'),
              type: 'link',
              auth: ['erp:order-vector:create'],
              loading: orderResetVectorLoading,
              ifShow:
                row.auditStatus === ErpOrderAuditStatus.ORDER_AUDIT_STATUS_3 &&
                (row.currentProcess ===
                  ErpOrderCurrentProcess.CURRENT_PROCESS_6 ||
                  row.currentProcess ===
                    ErpOrderCurrentProcess.CURRENT_PROCESS_7),
              popConfirm: {
                title: $t('erp.orderProcess.actionMessage.resetVectorConfirm', [
                  row.orderNo,
                ]),
                confirm: handleOrderResetVector.bind(null, row),
              },
            },
            {
              label: $t('common.copy'),
              type: 'link',
              icon: ACTION_ICON.COPY,
              auth: ['erp:order:create'],
              onClick: handleCopy.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              auth: ['erp:order:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [
                  row.orderNO,
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
