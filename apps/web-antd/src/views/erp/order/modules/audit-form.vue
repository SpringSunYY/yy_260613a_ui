<script lang="ts" setup>
import type { OrderAuditApi } from '#/api/erp/orderAudit';

import { computed, ref } from 'vue';

import { useVbenModelDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createOrderAudit } from '#/api/erp/orderAudit';
import { $t } from '#/locales';

import { useAuditFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<OrderAuditApi.OrderAudit>();
const getTitle = computed(() => {
  return $t('ui.actionTitle.create', [$t('erp.orderAudit.orderAudit')]);
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
  schema: useAuditFormSchema(),
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
    const data = (await formApi.getValues()) as OrderAuditApi.OrderAudit;
    try {
      // 不能传递id
      await createOrderAudit({
        ...data,
        id: null,
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
    const data = modalDrawerApi.getData<OrderAuditApi.OrderAudit>();
    if (!data) {
      return;
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
