<script lang="ts" setup>
import type { OrderProcessHistoryApi } from '#/api/erp/orderProcessHistory';

import { useVbenModelDrawer } from '@vben/common-ui';
import { message, Tabs, Checkbox, Input, Textarea, Select,RadioGroup,CheckboxGroup, DatePicker } from 'ant-design-vue';

import { computed, ref } from 'vue';
import { $t } from '#/locales';
import { useVbenForm } from '#/adapter/form';
import { getOrderProcessHistory, createOrderProcessHistory, updateOrderProcessHistory } from '#/api/erp/orderProcessHistory';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<OrderProcessHistoryApi.OrderProcessHistory>();
  const getTitle = computed(() => {
    return formData.value?.id
        ? $t('ui.actionTitle.edit', [$t('erp.orderProcessHistory.orderProcessHistory')])
        : $t('ui.actionTitle.create', [$t('erp.orderProcessHistory.orderProcessHistory')]);
  });


const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 80
  },
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false
});

const [ModalDrawer, modalDrawerApi] = useVbenModelDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
        modalDrawerApi.lock();
    // 提交表单
    const data = (await formApi.getValues()) as OrderProcessHistoryApi.OrderProcessHistory;
        try {
      await (formData.value?.id ? updateOrderProcessHistory(data) : createOrderProcessHistory(data));
      // 关闭并提示
      await modalDrawerApi.close();
      emit('success');
      message.success( $t('ui.actionMessage.operationSuccess') );
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
    let data = modalDrawerApi.getData<OrderProcessHistoryApi.OrderProcessHistory>();
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
  }
});
</script>

<template>
  <ModalDrawer :title="getTitle">
    <Form class="mx-4" />
      </ModalDrawer>
</template>