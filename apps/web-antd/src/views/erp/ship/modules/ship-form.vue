<script lang="ts" setup>
import type { OrderApi } from '#/api/erp/order';

import { computed, ref } from 'vue';

import { useVbenModelDrawer } from '@vben/common-ui';
import { Copy } from '@vben/icons';

import { useClipboard } from '@vueuse/core';
import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getOrderNo, shipOrder } from '#/api/erp/order';
import { $t } from '#/locales';

import { useShipFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<OrderApi.OrderShip>();
const rowData = ref<OrderApi.OrderShip>();
const getTitle = computed(() => {
  return `${$t('erp.orderProcess.action.ship')}-${formData.value?.orderNo}`;
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

/** 剪贴板 */
const { copy } = useClipboard({ legacy: true });

/** 复制发货地址 */
async function handleCopyShippingAddress() {
  const values = (await formApi.getValues()) as Record<string, any>;
  const value = values?.shippingAddress;
  if (!value) {
    message.warning($t('infra.file.message.copyFailed'));
    return;
  }
  try {
    await copy(value);
    message.success($t('ui.actionMessage.copySuccess'));
  } catch {
    message.error($t('infra.file.message.copyFailed'));
  }
}

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
      const shipData = { ...rowData.value, ...data } as OrderApi.OrderShip;
      await shipOrder(shipData);
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
    const drawerData = modalDrawerApi.getData<OrderApi.OrderShip>();
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
    formData.value = data as unknown as OrderApi.OrderShip;
    await formApi.setValues(formData.value);
  },
});
</script>

<template>
  <ModalDrawer :title="getTitle">
    <Form class="mx-4">
      <template #shippingAddress="slotProps">
        <AInput v-bind="slotProps">
          <template #suffix>
            <AButton
              type="link"
              size="small"
              :title="$t('common.copy')"
              @click="handleCopyShippingAddress"
            >
              <Copy class="size-4" />
            </AButton>
          </template>
        </AInput>
      </template>
    </Form>
  </ModalDrawer>
</template>
