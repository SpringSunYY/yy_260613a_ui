<script lang="ts" setup>
import type { OrderApi } from '#/api/erp/order';
import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModelDrawer } from '@vben/common-ui';

import { message, Tabs } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createOrder,
  getOrder,
  updateOrder,
} from '#/api/erp/order';
import { getOrderProcessByOrderNo } from '#/api/erp/orderProcess';
import { I18nSelect } from '#/components/i18n/i18n-select';
import { $t } from '#/locales';
import { DICT_TYPE, getDictOptions } from '#/utils';

import { useFormSchema as useProcessFormSchema } from '../../orderProcess/data';
import { uploadOrderPrintImage } from '../composables/use-order-print';
import { useFormSchema } from '../data';
import OrderDetailForm from './order-detail-form.vue';

const emit = defineEmits(['success']);

const { hasAccessByCodes } = useAccess();

const formData = ref<OrderApi.Order>();
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('erp.order.order')])
    : $t('ui.actionTitle.create', [$t('erp.order.order')]);
});

/** 子表的表单 */
const subTabsName = ref('orderDetail');
const orderDetailFormRef = ref<InstanceType<typeof OrderDetailForm>>();
const orderNo = ref('');

/** 子表尺码合计 -> 写入主表 number 字段 */
function onOrderDetailTotalChange(total: number) {
  formApi.setFieldValue('number', total);
}
/** 修改订单号 */
function changeOrderNo(event: Event) {
  const orderNo = (event.target as HTMLInputElement)?.value || '';
  processFormApi.setFieldValue('orderNo', orderNo);
}
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
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    // 校验订单明细
    const detailValid = orderDetailFormRef.value?.validate();
    if (!detailValid) {
      subTabsName.value = 'orderDetail';
      return;
    }
    // 校验工序
    const processValid = await processFormApi.validate();
    if (!processValid.valid) {
      subTabsName.value = 'orderProcess';
      return;
    }

    // 校验子表单
    modalDrawerApi.lock();
    // 提交表单
    const data = (await formApi.getValues()) as OrderApi.Order;
    // 拼接子表的数据
    data.orderDetails = orderDetailFormRef.value?.getData() || [];
    data.orderProcess =
      (await processFormApi.getValues()) as OrderProcessApi.OrderProcess;
    try {
      const isUpdate = !!formData.value?.id;
      await (isUpdate ? updateOrder(data) : createOrder(data));
      // 关闭并提示
      await modalDrawerApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
      // 异步静默上传打印图片，完全不阻塞主线程
      uploadOrderPrintImage(data.orderNo!);
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
    let data = modalDrawerApi.getData<OrderApi.Order & { isCopy?: boolean }>();
    const isCopy = !!data?.isCopy;
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
    if (data.orderNo) {
      // 查询订单工序
      getOrderProcessByOrderNo(data.orderNo).then((res) => {
        processFormApi.setValues(res);
      });
      orderNo.value = data.orderNo;
    }
    if (isCopy) {
      // 复制模式：保留订单明细，清空以下字段
      const copyData = {
        ...data,
        id: undefined,
        orderNo: undefined,
        orderTime: undefined,
        exceptShippingTime: undefined,
        shippingNo: undefined,
        hydration: undefined,
        shippingTime: undefined,
        // 清空订单明细中的 orderNo
        orderDetails: data.orderDetails?.map((item) => ({
          ...item,
          id: undefined,
          orderNo: undefined,
        })),
        // 清空订单工序中的 orderNo
        orderProcess: data.orderProcess
          ? { ...data.orderProcess, orderNo: undefined }
          : undefined,
      } as unknown as OrderApi.Order;
      formData.value = copyData;
      await formApi.setValues(copyData);
      return;
    }
    // 设置到 values
    formData.value = data;
    await formApi.setValues(formData.value);
    processFormApi.setFieldValue('orderNo', data.orderNo);
  },
});
</script>

<template>
  <ModalDrawer :title="getTitle" class="w-[75%]">
    <Form class="mx-4">
      <template #orderNo="slotProps">
        <a-input v-bind="slotProps" @change="changeOrderNo" />
      </template>
    </Form>
    <!-- 子表的表单 -->
    <Tabs v-model:active-key="subTabsName">
      <Tabs.TabPane
        key="orderDetail"
        :tab="$t('erp.orderDetail.orderDetail')"
        force-render
      >
        <OrderDetailForm
          ref="orderDetailFormRef"
          :order-no="orderNo"
          @update:total="onOrderDetailTotalChange"
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
    </Tabs>
  </ModalDrawer>
</template>
