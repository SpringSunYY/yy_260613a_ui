<script lang="ts" setup>
import type { OrderApi } from '#/api/erp/order';
import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { computed, ref } from 'vue';

import { useVbenModelDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getOrderNo, shipOrder } from '#/api/erp/order';
import { updateProcessToTargetProcess } from '#/api/erp/orderProcess';
import { $t } from '#/locales';
import { ErpOrderCurrentProcess } from '#/utils';

import { useShipFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<OrderApi.OrderShip>();
const rowData = ref<OrderProcessApi.OrderProcess>();
const getTitle = computed(() => {
  return `${$t('erp.orderProcess.action.ship')}-${formData.value?.id}`;
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 100,
  },
  layout: 'horizontal',
  schema: useShipFormSchema(),
  showDefaultActions: false,
});

const [ModalDrawer, modalDrawerApi] = useVbenModelDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalDrawerApi.lock();
    // 提交表单
    const data = (await formApi.getValues()) as OrderApi.Order;
    try {
      // 发货
      await shipOrder(data);
      await updateProcessToTargetProcess({
        ...(rowData.value as unknown as OrderProcessApi.OrderProcess),
        currentProcess: ErpOrderCurrentProcess.CURRENT_PROCESS_7,
      });
      // 关闭并提示
      await modalDrawerApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalDrawerApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      return;
    }
    // 加载数据
    const drawerData = modalDrawerApi.getData<OrderProcessApi.OrderProcess>();
    if (!drawerData?.orderNo) {
      return;
    }
    // 根据订单编号查询订单信息
    const data = await getOrderNo(drawerData.orderNo);
    if (!data) {
      return;
    }
    // 设置到 values
    rowData.value = drawerData;
    formData.value = data as OrderApi.OrderShip;
    await formApi.setValues(formData.value);
  },
});
</script>

<template>
  <ModalDrawer :title="getTitle">
    <Form class="mx-4" />
  </ModalDrawer>
</template>
