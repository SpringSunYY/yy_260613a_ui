<script lang="ts" setup>
import type { PageParam } from '@vben/request';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderApi } from '#/api/erp/order';

import { ref } from 'vue';

import { Page, useVbenModelDrawer } from '@vben/common-ui';
import { downloadFileFromBlobPart, formatPast2 } from '@vben/utils';

import { message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportOrder,
  getOrderShipStatistics,
  getShipOrderPage,
} from '#/api/erp/order';
import { getOrderProcessByOrderNo } from '#/api/erp/orderProcess';
import I18nDictTag from '#/components/i18n/i18n-dict-tag/i18n-dict-tag.vue';
import { $t } from '#/locales';
import { DICT_TYPE, pickSort } from '#/utils';
import FormView from '#/views/erp/order/modules/form-view.vue';
import ShipForm from '#/views/erp/ship/modules/ship-form.vue';

import { useGridColumns, useGridFormSchema } from './data';

const [ViewFormModalDrawer, viewFormModalDrawerApi] = useVbenModelDrawer({
  connectedComponent: FormView,
  destroyOnClose: true,
  type: 'drawer',
  externalCloseConfirm: false,
});

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

/** 查看订单信息 */
function handleView(row: OrderApi.Order) {
  viewFormModalDrawerApi.setData(row).open();
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
const todayStats = ref<OrderApi.OrderStatistics[]>([]);
const totalToday = ref(0);
const tomorrowStats = ref<OrderApi.OrderStatistics[]>([]);
const totalTomorrow = ref(0);
const dayAfterTomorrowStats = ref<OrderApi.OrderStatistics[]>([]);
const totalDayAfterTomorrow = ref(0);
function fetchStatistics(formValues: PageParam) {
  totalCount.value = 0;
  todayStats.value = [];
  tomorrowStats.value = [];
  dayAfterTomorrowStats.value = [];
  const fmt = 'YYYY-MM-DD HH:mm:ss';
  // 规格统计
  getOrderShipStatistics(formValues).then((res) => {
    if (!res) return;
    statisticsData.value = res;
    res?.forEach((item) => (totalCount.value += item.total));
  });
  // 今日待发
  getOrderShipStatistics({
    ...formValues,
    exceptShippingTime: [
      dayjs().startOf('day').format(fmt),
      dayjs().endOf('day').format(fmt),
    ],
  }).then((res) => {
    if (!res) return;
    todayStats.value = res;
    res?.forEach((item) => (totalToday.value += item.total));
  });
  // 明日待发
  getOrderShipStatistics({
    ...formValues,
    exceptShippingTime: [
      dayjs().add(1, 'day').startOf('day').format(fmt),
      dayjs().add(1, 'day').endOf('day').format(fmt),
    ],
  }).then((res) => {
    if (!res) return;
    tomorrowStats.value = res;
    totalTomorrow.value = res.reduce((acc, cur) => acc + cur.total, 0);
  });
  // 后日待发
  getOrderShipStatistics({
    ...formValues,
    exceptShippingTime: [
      dayjs().add(2, 'day').startOf('day').format(fmt),
      dayjs().add(2, 'day').endOf('day').format(fmt),
    ],
  }).then((res) => {
    if (!res) return;
    dayAfterTomorrowStats.value = res;
    totalDayAfterTomorrow.value = res.reduce((acc, cur) => acc + cur.total, 0);
  });
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    size: 'medium',
    pagerConfig: {
      enabled: true,
    },
    proxyConfig: {
      ajax: {
        query: async (ctx, formValues) => {
          fetchStatistics(formValues);
          const { page } = ctx || {};
          const { sortBy, sort } = pickSort(ctx);
          return await getShipOrderPage({
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

function parseExceptShippingTime(exceptShippingTime: number) {
  if (!exceptShippingTime) return '';
  // 获取当前时间戳
  const now = Date.now();
  let diff = now - exceptShippingTime;
  let prefix = '已超时';
  if (diff < 0) {
    diff = -diff;
    prefix = '还剩';
  }
  const timeStr = formatPast2(diff);
  return `${prefix}${timeStr}`;
}

function isTimeOut(exceptShippingTime: number): boolean {
  if (!exceptShippingTime) return false;
  // 获取当前时间戳
  const now = Date.now();
  const diff = now - exceptShippingTime;
  return diff > 0;
}
</script>

<template>
  <Page auto-content-height>
    <ViewFormModalDrawer />
    <ShipFormModalDrawer @success="onRefresh" />
    <Grid :table-title="$t('erp.order.order')">
      <template #table-title>
        <div class="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
          <span class="inline-flex items-center gap-x-0">
            总计：{{ totalCount }}
            <template v-for="item in todayStats" :key="item.name">
              <I18nDictTag
                :type="DICT_TYPE.ERP_SPECIFICATION"
                :value="item.name"
              />
              ：<span class="text-primary">{{ item.total }}</span>
            </template>
          </span>
          <span class="inline-flex items-center gap-x-0">
            今日待发：{{ totalToday }}
            <template v-for="item in todayStats" :key="item.name">
              <I18nDictTag
                :type="DICT_TYPE.ERP_SPECIFICATION"
                :value="item.name"
              />
              ：<span class="text-primary">{{ item.total }}</span>
            </template>
          </span>
          <span class="inline-flex items-center gap-x-0">
            明日待发：{{ totalTomorrow }}
            <template v-for="item in tomorrowStats" :key="item.name">
              <I18nDictTag
                :type="DICT_TYPE.ERP_SPECIFICATION"
                :value="item.name"
              />
              ：<span class="text-primary">{{ item.total }}</span>
            </template>
          </span>
          <span class="inline-flex items-center gap-x-0">
            后日待发：{{ totalDayAfterTomorrow }}
            <template v-for="item in dayAfterTomorrowStats" :key="item.name">
              <I18nDictTag
                :type="DICT_TYPE.ERP_SPECIFICATION"
                :value="item.name"
              />
              ：<span class="text-primary">{{ item.total }}</span>
            </template>
          </span>
        </div>
      </template>
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.export', [$t('erp.order.order')]),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:order:export'],
              onClick: handleExport,
              loading: exportLoading,
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
            //发货
            {
              label: $t('erp.orderProcess.action.ship'),
              type: 'link',
              icon: ACTION_ICON.SHIP,
              auth: [
                'erp.orderProcess.action.ship',
                'erp:order-process:complete',
              ],
              onClick: handleOrderShip.bind(null, row),
            },
          ]"
        />
      </template>
      <template #orderStatus="{ row }">
        <div>
          <div>
            <I18nDictTag
              :type="DICT_TYPE.ERP_ORDER_STATUS"
              :value="row.orderStatus"
            />
          </div>
          <div
            :style="{
              color: isTimeOut(row.exceptShippingTime) ? 'red' : 'green',
            }"
          >
            {{ parseExceptShippingTime(row.exceptShippingTime) }}
          </div>
        </div>
      </template>
    </Grid>
  </Page>
</template>
