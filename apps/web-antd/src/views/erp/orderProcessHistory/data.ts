import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderProcessHistoryApi } from '#/api/erp/orderProcessHistory';

import { $t } from '@vben/locales';

import { DICT_TYPE, getDictOptions, getRangePickerDefaultProps } from '#/utils';
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
      label: $t('erp.orderProcessHistory.field.orderNo'),
      rules: 'required',
      component: 'Input',
      componentProps: {
        readonly: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderProcessHistory.field.orderNo'),
        ]),
      },
    },
    /** 原工序 */
    {
      fieldName: 'oldProcess',
      label: $t('erp.orderProcessHistory.field.oldProcess'),
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcessHistory.field.oldProcess'),
        ]),
      },
    },
    /** 当前工序 */
    {
      fieldName: 'currentProcess',
      label: $t('erp.orderProcessHistory.field.currentProcess'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcessHistory.field.currentProcess'),
        ]),
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
      label: $t('erp.orderProcessHistory.field.orderNo'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderProcessHistory.field.orderNo'),
        ]),
      },
    },
    /** 原工序 */
    {
      fieldName: 'oldProcess',
      label: $t('erp.orderProcessHistory.field.oldProcess'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcessHistory.field.oldProcess'),
        ]),
      },
    },
    /** 当前工序 */
    {
      fieldName: 'currentProcess',
      label: $t('erp.orderProcessHistory.field.currentProcess'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcessHistory.field.currentProcess'),
        ]),
      },
    },
    /** 创建时间 */
    {
      fieldName: 'createTime',
      label: $t('erp.orderProcessHistory.field.createTime'),
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions<OrderProcessHistoryApi.OrderProcessHistory>['columns'] {
  return [
    { type: 'checkbox', width: 40 },
    /** 编号 */
    {
      field: 'id',
      title: $t('erp.orderProcessHistory.field.id'),
      minWidth: 120,
    },
    /** 订单号 */
    {
      field: 'orderNo',
      title: $t('erp.orderProcessHistory.field.orderNo'),
      minWidth: 120,
    },
    /** 原工序 */
    {
      field: 'oldProcess',
      title: $t('erp.orderProcessHistory.field.oldProcess'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_CURRENT_PROCESS },
      },
    },
    /** 当前工序 */
    {
      field: 'currentProcess',
      title: $t('erp.orderProcessHistory.field.currentProcess'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_CURRENT_PROCESS },
      },
    },
    /** 创建人*/
    {
      field: 'creator',
      title: $t('erp.orderProcessHistory.field.creator'),
      minWidth: 120,
    },
    /** 创建时间 */
    {
      field: 'createTime',
      title: $t('erp.orderProcessHistory.field.createTime'),
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
