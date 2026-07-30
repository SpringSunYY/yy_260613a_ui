<script lang="ts" setup>
import type { OrderApi } from '#/api/erp/order';
import type { OrderAuditApi } from '#/api/erp/orderAudit';
import type { OrderProcessHistoryApi } from '#/api/erp/orderProcessHistory';

import { computed, ref } from 'vue';

import { useVbenModelDrawer } from '@vben/common-ui';

import { Tag } from 'ant-design-vue';

import { getOrderNo } from '#/api/erp/order';
import { getOrderProcessHistoryByNo } from '#/api/erp/orderProcessHistory';
import { TimelineLog } from '#/components/timeline-log';
import { $t } from '#/locales';
import { DICT_TYPE, getDictLabel } from '#/utils';

const formData = ref<OrderAuditApi.OrderAudit>();
const getTitle = computed(() => {
  return $t('erp.orderProcessHistory.orderProcessHistory');
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
    // console.log('data', data);
    if (!data || !data?.orderNo) {
      return;
    }
    modalDrawerApi.lock();
    try {
      data = await getOrderNo(data.orderNo);
      // 查询工序历史（时间线）
      await loadOrderProcessHistory(data.orderNo);
    } finally {
      modalDrawerApi.unlock();
    }
  },
});
</script>

<template>
  <ModalDrawer :title="getTitle">
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
  </ModalDrawer>
</template>
