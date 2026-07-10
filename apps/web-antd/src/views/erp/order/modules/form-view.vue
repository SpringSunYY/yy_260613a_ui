<script lang="ts" setup>
import type { OrderApi } from '#/api/erp/order';
import type { OrderAuditApi } from '#/api/erp/orderAudit';
import type { OrderProcessHistoryApi } from '#/api/erp/orderProcessHistory';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModelDrawer } from '@vben/common-ui';

import { Tabs, Tag } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getOrderNo } from '#/api/erp/order';
import { getOrderAuditByNo } from '#/api/erp/orderAudit';
import { getOrderProcessByOrderNo } from '#/api/erp/orderProcess';
import { getOrderProcessHistoryByNo } from '#/api/erp/orderProcessHistory';
import { I18nSelect } from '#/components/i18n/i18n-select';
import { TimelineLog } from '#/components/timeline-log';
import { $t } from '#/locales';
import { DICT_TYPE, getDictLabel, getDictOptions } from '#/utils';

import { useFormSchema as useProcessFormSchema } from '../../orderProcess/data';
import { useFormSchema } from '../data';
import OrderDetailFormView from './order-detail-form-view.vue';

const { hasAccessByCodes } = useAccess();

const formData = ref<OrderApi.Order>();
const getTitle = computed(() => {
  return $t('erp.order.order');
});

/** 子表的表单 */
const subTabsName = ref('orderDetail');
const orderDetailFormRef = ref<InstanceType<typeof OrderDetailFormView>>();

/** 工序 */
const [ProcessForm, processFormApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-1',
    labelWidth: 80,
  },
  layout: 'horizontal',
  wrapperClass: 'grid-cols-4',
  schema: useProcessFormSchema(),
  showDefaultActions: false,
});
const processFormRef = ref<InstanceType<typeof ProcessForm>>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-1',
  },
  wrapperClass: 'grid-cols-3',
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [ModalDrawer, modalDrawerApi] = useVbenModelDrawer({
  async onConfirm() {
    // 关闭并提示
    await modalDrawerApi.close();
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      return;
    }
    // 加载数据
    let data = modalDrawerApi.getData<OrderApi.Order>();
    console.log('data', data);
    if (!data || !data?.orderNo) {
      return;
    }
    modalDrawerApi.lock();
    try {
      data = await getOrderNo(data.orderNo);
      // 查询订单工序
      getOrderProcessByOrderNo(data?.orderNo || '').then((res) => {
        processFormApi.setValues(res);
      });
      // 查询工序历史（时间线）
      await loadOrderProcessHistory(data.orderNo);
      // 查询审核记录（时间线）
      await loadAuditList(data.orderNo);
    } finally {
      modalDrawerApi.unlock();
    }
    // 设置到 values
    formData.value = data;
    await formApi.setValues(formData.value);
    await processFormApi.setFieldValue('orderNo', data.orderNo);
    // 设置为只读
    formApi.setDisabled(true);
    processFormApi.setDisabled(true);
  },
});

// === 工序历史时间线 ===
interface ProcessHistoryTimelineItem {
  id: number;
  createTime?: string;
  raw?: OrderProcessHistoryApi.OrderProcessHistoryDetail;
}

const processHistoryList = ref<ProcessHistoryTimelineItem[]>([]);

/** 加载工序历史 */
async function loadOrderProcessHistory(orderNo?: string) {
  if (!orderNo) {
    processHistoryList.value = [];
    return;
  }
  const list = await getOrderProcessHistoryByNo(orderNo);
  processHistoryList.value = list.map((item) => ({
    id: item.id as number,
    createTime: item.createTime as unknown as string,
    avatar: item.avatar,
    userName: item.creator,
    raw: item,
  }));
}

// === 审核记录时间线 ===
interface AuditTimelineItem {
  id: number;
  createTime?: string;
  raw?: OrderAuditApi.OrderAuditDetail;
}

const auditList = ref<AuditTimelineItem[]>([]);

/** 加载审核记录 */
async function loadAuditList(orderNo?: string) {
  if (!orderNo) {
    auditList.value = [];
    return;
  }
  const list = await getOrderAuditByNo(orderNo);
  auditList.value = list.map((item) => ({
    id: item.id as number,
    createTime: item.createTime as unknown as string,
    avatar: item.avatar,
    userName: item.creator,
    raw: item,
  }));
}
</script>

<template>
  <ModalDrawer :title="getTitle" class="w-[75%]">
    <Form class="mx-4">
      <template #orderNo="slotProps">
        <a-input v-bind="slotProps" />
      </template>
    </Form>
    <!-- 子表的表单 -->
    <Tabs v-model:active-key="subTabsName">
      <Tabs.TabPane
        key="orderDetail"
        :tab="$t('erp.orderDetail.orderDetail')"
        force-render
      >
        <OrderDetailFormView
          ref="orderDetailFormRef"
          :order-no="formData?.orderNo"
        />
      </Tabs.TabPane>
      <Tabs.TabPane
        v-if="hasAccessByCodes(['erp:order-process:create'])"
        key="orderProcess"
        :tab="$t('erp.orderProcess.orderProcess')"
        force-render
      >
        <ProcessForm ref="processFormRef">
          <template #currentProcess="slotProps">
            <I18nSelect
              v-bind="slotProps"
              :disabled="true"
              :options="
                getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string')
              "
            />
          </template>
        </ProcessForm>
      </Tabs.TabPane>
      <Tabs.TabPane
        v-if="hasAccessByCodes(['erp:order-process-history:query'])"
        key="orderProcessHistory"
        :tab="$t('erp.orderProcessHistory.orderProcessHistory')"
        force-render
      >
        <div class="px-4">
          <TimelineLog :log-list="processHistoryList">
            <template #action="{ log }">
              <span class="text-gray-500">{{ log.userName }}</span>
              <span class="mx-1 text-gray-400">把订单工序从</span>
              <Tag>
                {{
                  getDictLabel(
                    DICT_TYPE.ERP_ORDER_CURRENT_PROCESS,
                    log.raw?.oldProcess,
                  )
                }}
              </Tag>
              <span class="mx-1 text-gray-400">更新为</span>
              <Tag color="success">
                {{
                  getDictLabel(
                    DICT_TYPE.ERP_ORDER_CURRENT_PROCESS,
                    log.raw?.currentProcess,
                  )
                }}
              </Tag>
            </template>
          </TimelineLog>
        </div>
      </Tabs.TabPane>
      <Tabs.TabPane
        v-if="hasAccessByCodes(['erp:order-audit:query'])"
        key="orderAudit"
        :tab="$t('erp.orderAudit.orderAudit')"
        force-render
      >
        <div class="px-4">
          <TimelineLog :log-list="auditList">
            <template #action="{ log }">
              <span class="text-gray-500">{{ log.userName }}</span>
              <span class="mx-1 text-gray-400">审核订单，从</span>
              <Tag>
                {{
                  getDictLabel(
                    DICT_TYPE.ERP_ORDER_AUDIT_STATUS,
                    log.raw?.oldAuditStatus,
                  )
                }}
              </Tag>
              <span class="mx-1 text-gray-400">审核为</span>
              <Tag color="success">
                {{
                  getDictLabel(
                    DICT_TYPE.ERP_ORDER_AUDIT_STATUS,
                    log.raw?.auditStatus,
                  )
                }}
              </Tag>
              <span v-if="log.raw?.auditRemark" class="ml-2 text-gray-400">
                审核原因：{{ log.raw?.auditRemark }}
              </span>
            </template>
          </TimelineLog>
        </div>
      </Tabs.TabPane>
    </Tabs>
  </ModalDrawer>
</template>
