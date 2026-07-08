<script lang="ts" setup>
import type { OrderProcessHistoryApi } from '#/api/erp/orderProcessHistory';

import { computed, ref } from 'vue';

import { useVbenModelDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { getOrderProcessHistory } from '#/api/erp/orderProcessHistory';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const formData = ref<OrderProcessHistoryApi.OrderProcessHistory>();
const getTitle = computed(() => {
  return $t('erp.orderProcessHistory.orderProcessHistory');
});

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
    modalDrawerApi.lock();

    // 关闭并提示
    await modalDrawerApi.close();
    modalDrawerApi.unlock();
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      return;
    }
    // 加载数据
    let data =
      modalDrawerApi.getData<OrderProcessHistoryApi.OrderProcessHistory>();
    if (!data) {
      return;
    }
    if (data.id) {
      modalDrawerApi.lock();
      try {
        data = await getOrderProcessHistory(data.id);
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
  </ModalDrawer>
</template>
