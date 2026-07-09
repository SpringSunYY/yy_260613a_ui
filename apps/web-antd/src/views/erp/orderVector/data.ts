import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderVectorApi } from '#/api/erp/orderVector';

import { $t } from '@vben/locales';

import { getRangePickerDefaultProps, MODULE_TYPE_ENUM } from '#/utils';
/** 新增/修改的表单 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: {
        triggerFields: [''],
        show: () => false,
      },
    },
    /** 订单号 */
    {
      fieldName: 'orderNo',
      label: $t('erp.orderVector.field.orderNo'),
      rules: 'required',
      component: 'Input',
      componentProps: {
        readonly: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderVector.field.orderNo'),
        ]),
      },
    },
    /** 向量编号 */
    {
      fieldName: 'vectorId',
      label: $t('erp.orderVector.field.vectorId'),
      rules: 'required',
      component: 'Input',
      componentProps: {
        readonly: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderVector.field.vectorId'),
        ]),
      },
    },
    /** 图片地址 */
    {
      fieldName: 'imageUrl',
      label: $t('erp.orderVector.field.imageUrl'),
      rules: 'required',
      component: 'ImageUpload',
      componentProps: {
        maxNumber: 1,
        disabled: true,
        moduleType: MODULE_TYPE_ENUM.ERP,
      },
    },
  ];
}

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    /** 订单号 */
    {
      fieldName: 'orderNo',
      label: $t('erp.orderVector.field.orderNo'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderVector.field.orderNo'),
        ]),
      },
    },
    /** 向量编号 */
    {
      fieldName: 'vectorId',
      label: $t('erp.orderVector.field.vectorId'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderVector.field.vectorId'),
        ]),
      },
    },
    /** 创建时间 */
    {
      fieldName: 'createTime',
      label: $t('erp.orderVector.field.createTime'),
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions<OrderVectorApi.OrderVector>['columns'] {
  return [
    { type: 'checkbox', width: 40 },
    /** 编号 */
    {
      field: 'id',
      title: $t('erp.orderVector.field.id'),
      minWidth: 120,
    },
    /** 订单号 */
    {
      field: 'orderNo',
      title: $t('erp.orderVector.field.orderNo'),
      minWidth: 120,
    },
    /** 向量编号 */
    {
      field: 'vectorId',
      title: $t('erp.orderVector.field.vectorId'),
      minWidth: 120,
    },
    /** 图片地址 */
    {
      field: 'imageUrl',
      title: $t('erp.orderVector.field.imageUrl'),
      minWidth: 120,
      cellRender: {
        name: 'CellImage',
        props: {
          width: 80,
          height: 80,
        },
      },
    },
    /** 创建时间 */
    {
      field: 'createTime',
      title: $t('erp.orderVector.field.createTime'),
      minWidth: 120,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      title: $t('common.operation'),
      width: 200,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];
}
