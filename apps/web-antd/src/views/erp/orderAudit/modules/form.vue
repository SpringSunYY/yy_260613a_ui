<script lang="ts" setup>
import type { OrderAuditApi } from '#/api/erp/orderAudit';

import { useVbenModelDrawer } from '@vben/common-ui';
import { message, Tabs, Checkbox, Input, Textarea, Select,RadioGroup,CheckboxGroup, DatePicker } from 'ant-design-vue';

import { computed, ref } from 'vue';
import { $t } from '#/locales';
import { useVbenForm } from '#/adapter/form';
import { getOrderAudit, createOrderAudit, updateOrderAudit } from '#/api/erp/orderAudit';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<OrderAuditApi.OrderAudit>();
  const getTitle = computed(() => {
    return formData.value?.id
        ? $t('ui.actionTitle.edit', [$t('erp.orderAudit.orderAudit')])
        : $t('ui.actionTitle.create', [$t('erp.orderAudit.orderAudit')]);
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
    const data = (await formApi.getValues()) as OrderAuditApi.OrderAudit;
        try {
      await (formData.value?.id ? updateOrderAudit(data) : createOrderAudit(data));
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
    let data = modalDrawerApi.getData<OrderAuditApi.OrderAudit>();
    if (!data) {
      return;
    }
    if (data.id) {
      modalDrawerApi.lock();
      try {
        data = await getOrderAudit(data.id);
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