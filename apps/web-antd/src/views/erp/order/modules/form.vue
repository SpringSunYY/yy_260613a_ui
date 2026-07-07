<script lang="ts" setup>
import type { OrderApi } from '#/api/erp/order';

import { computed, ref } from 'vue';

import { useVbenModelDrawer } from '@vben/common-ui';

import { message, Tabs } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createOrder, getOrder, updateOrder } from '#/api/erp/order';
import { $t } from '#/locales';

import { useFormSchema } from '../data';
import OrderDetailForm from './order-detail-form.vue';

const emit = defineEmits(['success']);
const formData = ref<OrderApi.Order>();
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('erp.order.order')])
    : $t('ui.actionTitle.create', [$t('erp.order.order')]);
});

/** 子表的表单 */
const subTabsName = ref('orderDetail');
const orderDetailFormRef = ref<InstanceType<typeof OrderDetailForm>>();

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 80,
  },
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [ModalDrawer, modalDrawerApi] = useVbenModelDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    // 校验子表单
    modalDrawerApi.lock();
    // 提交表单
    const data = (await formApi.getValues()) as OrderApi.Order;
    // 拼接子表的数据
    data.orderDetails = orderDetailFormRef.value?.getData() || [];
    try {
      await (formData.value?.id ? updateOrder(data) : createOrder(data));
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
    let data = modalDrawerApi.getData<OrderApi.Order>();
    if (!data) {
      return;
    }
    if (data.id) {
      modalDrawerApi.lock();
      try {
        data = await getOrder(data.id);
      } finally {
        modalDrawerApi.unlock();
      }
    }
    // 设置到 values
    formData.value = data;
    await formApi.setValues(formData.value);
  },
});
</script>

<template>
  <ModalDrawer :title="getTitle">
    <Form class="mx-4" />
    <!-- 子表的表单 -->
    <Tabs v-model:active-key="subTabsName">
      <Tabs.TabPane
        key="orderDetail"
        :tab="$t('erp.orderDetail.orderDetail')"
        force-render
      >
        <OrderDetailForm
          ref="orderDetailFormRef"
          :order-no="formData?.orderNo"
        />
      </Tabs.TabPane>
    </Tabs>
  </ModalDrawer>
</template>
