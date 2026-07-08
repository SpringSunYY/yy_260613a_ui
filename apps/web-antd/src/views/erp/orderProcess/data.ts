import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { useAccess } from '@vben/access';
import { $t } from '@vben/locales';

import { DICT_TYPE, getDictOptions, getRangePickerDefaultProps } from '#/utils';

const { hasAccessByCodes } = useAccess();
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
    /** 当前工序 */
    {
      fieldName: 'currentProcess',
      label: $t('erp.orderProcess.field.currentProcess'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.currentProcess'),
        ]),
      },
      dependencies: {
        triggerFields: [''],
        show: () => hasAccessByCodes(['erp:order-process:complete']),
      },
      formItemClass: 'col-span-4',
    },
    /** 订单号 */
    {
      fieldName: 'orderNo',
      label: $t('erp.orderProcess.field.orderNo'),
      rules: 'required',
      component: 'Input',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderProcess.field.orderNo'),
        ]),
        readonly: true,
      },
    },
    /** 排版人 */
    {
      fieldName: 'layoutPerson',
      label: $t('erp.orderProcess.field.layoutPerson'),
      component: 'Input',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderProcess.field.layoutPerson'),
        ]),
      },
    },
    /** 版型 */
    {
      fieldName: 'pattern',
      label: $t('erp.orderProcess.field.pattern'),
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_PATTERN, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.pattern'),
        ]),
      },
    },
    /** 布料 */
    {
      fieldName: 'fabric',
      label: $t('erp.orderProcess.field.fabric'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_FABRIC, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.fabric'),
        ]),
      },
    },
    /** 品类 */
    {
      fieldName: 'category',
      label: $t('erp.orderProcess.field.category'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_CATEGORY, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.category'),
        ]),
      },
    },
    /** 规格 */
    {
      fieldName: 'specification',
      label: $t('erp.orderProcess.field.specification'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_SPECIFICATION, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.specification'),
        ]),
      },
    },
    /** 开叉与否 */
    {
      fieldName: 'hasForked',
      label: $t('erp.orderProcess.field.hasForked'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_HAS_FORKED, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.hasForked'),
        ]),
      },
    },
    /** 衫脚 */
    {
      fieldName: 'shirtHem',
      label: $t('erp.orderProcess.field.shirtHem'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_SHIRT_HEM, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.shirtHem'),
        ]),
      },
    },
    /** 口袋 */
    {
      fieldName: 'pocket',
      label: $t('erp.orderProcess.field.pocket'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_POCKET, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.pocket'),
        ]),
      },
    },
    /** 领口 */
    {
      fieldName: 'neckline',
      label: $t('erp.orderProcess.field.neckline'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_NECKLINE, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.neckline'),
        ]),
      },
    },
    /** 包装要求 */
    {
      fieldName: 'packagingRequirements',
      label: $t('erp.orderProcess.field.packagingRequirements'),
      component: 'Textarea',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderProcess.field.packagingRequirements'),
        ]),
      },
    },
    /** 车间要求 */
    {
      fieldName: 'workshopRequirements',
      label: $t('erp.orderProcess.field.workshopRequirements'),
      component: 'Textarea',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderProcess.field.workshopRequirements'),
        ]),
      },
    },
    /** 图片 */
    {
      fieldName: 'orderImage',
      label: $t('erp.orderProcess.field.orderImage'),
      component: 'ImageUpload',
      componentProps: {
        moduleType: 'erp',
      },
      formItemClass: 'col-span-2',
    },
    /** 二维码 */
    {
      fieldName: 'qrCode',
      label: $t('erp.orderProcess.field.qrCode'),
      component: 'ImageUpload',
      componentProps: {
        moduleType: 'erp',
      },
      formItemClass: 'col-span-2',
    },
    /** 特别备注 */
    {
      fieldName: 'remark',
      label: $t('erp.orderProcess.field.remark'),
      component: 'Textarea',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderProcess.field.remark'),
        ]),
      },
      formItemClass: 'col-span-4',
    },
  ];
}

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    /** 当前工序 */
    {
      fieldName: 'currentProcess',
      label: $t('erp.orderProcess.field.currentProcess'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.currentProcess'),
        ]),
      },
    },
    /** 订单号 */
    {
      fieldName: 'orderNo',
      label: $t('erp.orderProcess.field.orderNo'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderProcess.field.orderNo'),
        ]),
      },
    },
    /** 排版人 */
    {
      fieldName: 'layoutPerson',
      label: $t('erp.orderProcess.field.layoutPerson'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderProcess.field.layoutPerson'),
        ]),
      },
    },
    /** 版型 */
    {
      fieldName: 'pattern',
      label: $t('erp.orderProcess.field.pattern'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_PATTERN, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.pattern'),
        ]),
      },
    },
    /** 布料 */
    {
      fieldName: 'fabric',
      label: $t('erp.orderProcess.field.fabric'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_FABRIC, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.fabric'),
        ]),
      },
    },
    /** 品类 */
    {
      fieldName: 'category',
      label: $t('erp.orderProcess.field.category'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_CATEGORY, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.category'),
        ]),
      },
    },
    /** 规格 */
    {
      fieldName: 'specification',
      label: $t('erp.orderProcess.field.specification'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_SPECIFICATION, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.specification'),
        ]),
      },
    },
    /** 开叉与否 */
    {
      fieldName: 'hasForked',
      label: $t('erp.orderProcess.field.hasForked'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_HAS_FORKED, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.hasForked'),
        ]),
      },
    },
    /** 衫脚 */
    {
      fieldName: 'shirtHem',
      label: $t('erp.orderProcess.field.shirtHem'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_SHIRT_HEM, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.shirtHem'),
        ]),
      },
    },
    /** 口袋 */
    {
      fieldName: 'pocket',
      label: $t('erp.orderProcess.field.pocket'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_POCKET, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.pocket'),
        ]),
      },
    },
    /** 领口 */
    {
      fieldName: 'neckline',
      label: $t('erp.orderProcess.field.neckline'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_NECKLINE, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.neckline'),
        ]),
      },
    },
    /** 创建时间 */
    {
      fieldName: 'createTime',
      label: $t('erp.orderProcess.field.createTime'),
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions<OrderProcessApi.OrderProcess>['columns'] {
  return [
    { type: 'checkbox', width: 40 },
    /** 编号 */
    {
      field: 'id',
      title: $t('erp.orderProcess.field.id'),
      minWidth: 120,
    },
    /** 当前工序 */
    {
      field: 'currentProcess',
      title: $t('erp.orderProcess.field.currentProcess'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_CURRENT_PROCESS },
      },
    },
    /** 订单号 */
    {
      field: 'orderNo',
      title: $t('erp.orderProcess.field.orderNo'),
      minWidth: 120,
    },
    /** 排版人 */
    {
      field: 'layoutPerson',
      title: $t('erp.orderProcess.field.layoutPerson'),
      minWidth: 120,
    },
    /** 图片 */
    {
      field: 'orderImage',
      title: $t('erp.orderProcess.field.orderImage'),
      minWidth: 120,
      cellRender: {
        name: 'CellImage',
        props: {
          width: 80,
          height: 80,
        },
      },
    },
    /** 二维码 */
    {
      field: 'qrCode',
      title: $t('erp.orderProcess.field.qrCode'),
      minWidth: 120,
      cellRender: {
        name: 'CellImage',
        props: {
          width: 80,
          height: 80,
        },
      },
    },
    /** 版型 */
    {
      field: 'pattern',
      title: $t('erp.orderProcess.field.pattern'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_PATTERN },
      },
    },
    /** 布料 */
    {
      field: 'fabric',
      title: $t('erp.orderProcess.field.fabric'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_FABRIC },
      },
    },
    /** 品类 */
    {
      field: 'category',
      title: $t('erp.orderProcess.field.category'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_CATEGORY },
      },
    },
    /** 规格 */
    {
      field: 'specification',
      title: $t('erp.orderProcess.field.specification'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_SPECIFICATION },
      },
    },
    /** 开叉与否 */
    {
      field: 'hasForked',
      title: $t('erp.orderProcess.field.hasForked'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_HAS_FORKED },
      },
    },
    /** 衫脚 */
    {
      field: 'shirtHem',
      title: $t('erp.orderProcess.field.shirtHem'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_SHIRT_HEM },
      },
    },
    /** 口袋 */
    {
      field: 'pocket',
      title: $t('erp.orderProcess.field.pocket'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_POCKET },
      },
    },
    /** 领口 */
    {
      field: 'neckline',
      title: $t('erp.orderProcess.field.neckline'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_NECKLINE },
      },
    },
    /** 包装要求 */
    {
      field: 'packagingRequirements',
      title: $t('erp.orderProcess.field.packagingRequirements'),
      minWidth: 120,
    },
    /** 车间要求 */
    {
      field: 'workshopRequirements',
      title: $t('erp.orderProcess.field.workshopRequirements'),
      minWidth: 120,
    },
    /** 特别备注 */
    {
      field: 'remark',
      title: $t('erp.orderProcess.field.remark'),
      minWidth: 120,
    },
    /** 创建人*/
    {
      field: 'creator',
      title: $t('erp.orderProcess.field.creator'),
      minWidth: 120,
      visible: false,
    },
    /** 创建时间 */
    {
      field: 'createTime',
      title: $t('erp.orderProcess.field.createTime'),
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
