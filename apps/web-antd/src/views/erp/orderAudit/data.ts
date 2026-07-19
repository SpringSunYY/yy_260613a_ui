import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderAuditApi } from '#/api/erp/orderAudit';

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
      label: $t('erp.orderAudit.field.orderNo'),
      rules: 'required',
      component: 'Input',
      componentProps: {
        readonly: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderAudit.field.orderNo'),
        ]),
      },
    },
    /** 原状态 */
    {
      fieldName: 'oldAuditStatus',
      label: $t('erp.orderAudit.field.oldAuditStatus'),
      rules: 'required',
      component: 'I18nRadioGroup',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_AUDIT_STATUS, 'string'),
        buttonStyle: 'solid',
        optionType: 'button',
      },
    },
    /** 审核状态 */
    {
      fieldName: 'auditStatus',
      label: $t('erp.orderAudit.field.auditStatus'),
      rules: 'required',
      component: 'I18nRadioGroup',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_AUDIT_STATUS, 'string'),
        buttonStyle: 'solid',
        optionType: 'button',
      },
    },
    /** 审核意见 */
    {
      fieldName: 'auditRemark',
      label: $t('erp.orderAudit.field.auditRemark'),
      component: 'Textarea',
      componentProps: {
        readonly: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderAudit.field.auditRemark'),
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
      label: $t('erp.orderAudit.field.orderNo'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderAudit.field.orderNo'),
        ]),
      },
    },
    /** 原状态 */
    {
      fieldName: 'oldAuditStatus',
      label: $t('erp.orderAudit.field.oldAuditStatus'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_AUDIT_STATUS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderAudit.field.oldAuditStatus'),
        ]),
      },
    },
    /** 审核状态 */
    {
      fieldName: 'auditStatus',
      label: $t('erp.orderAudit.field.auditStatus'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_AUDIT_STATUS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderAudit.field.auditStatus'),
        ]),
      },
    },
    /** 创建时间 */
    {
      fieldName: 'createTime',
      label: $t('erp.orderAudit.field.createTime'),
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions<OrderAuditApi.OrderAudit>['columns'] {
  return [
    { type: 'checkbox', width: 40 },
    {
      field: 'serialNumber',
      width: 50,
      title: $t('erp.orderDetail.field.serialNumber'),
      slots: { default: 'serialNumber' },
    },
    /** 编号 */
    {
      field: 'id',
      title: $t('erp.orderAudit.field.id'),
      minWidth: 120,
      visible: false,
    },
    /** 订单号 */
    {
      field: 'orderNo',
      title: $t('erp.orderAudit.field.orderNo'),
      minWidth: 120,
    },
    /** 原状态 */
    {
      field: 'oldAuditStatus',
      title: $t('erp.orderAudit.field.oldAuditStatus'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_AUDIT_STATUS },
      },
    },
    /** 审核状态 */
    {
      field: 'auditStatus',
      title: $t('erp.orderAudit.field.auditStatus'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_AUDIT_STATUS },
      },
    },
    /** 审核意见 */
    {
      field: 'auditRemark',
      title: $t('erp.orderAudit.field.auditRemark'),
      minWidth: 120,
    },
    /** 创建人*/
    {
      field: 'creator',
      title: $t('erp.orderAudit.field.creator'),
      minWidth: 120,
    },
    /** 创建时间 */
    {
      field: 'createTime',
      title: $t('erp.orderAudit.field.createTime'),
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
