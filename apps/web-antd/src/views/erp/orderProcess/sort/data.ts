import type { ComputedRef } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { computed } from 'vue';

import { $t } from '@vben/locales';

import {
  DICT_TYPE,
  getDictOptions,
  getRangePickerDefaultProps,
  MODULE_TYPE_ENUM,
} from '#/utils';

/** 翻页：可选择的每页条数（保持最少项，避免换行到第二行） */
export const CARD_PAGE_SIZE_OPTIONS = ['20', '30', '50', '100', '200'];

/** 左侧工序筛选值：当前工序 = 待排版 */
export const LEFT_PROCESS_VALUE = '2';

/** 右侧工序筛选值：当前工序不在 [已下单, 待排版] 内 = 排版中或之后 */
export const RIGHT_EXCLUDED_PROCESSES = ['1', '2'];

/** 顶部查询表单 schema */
export function useSearchSchema(): VbenFormSchema[] {
  return [
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
      },
    },
    /** 当前工序 */
    {
      fieldName: 'currentProcess',
      label: $t('erp.orderProcess.field.currentProcess'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.currentProcess'),
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
    /** 布料 */
    {
      fieldName: 'fabric',
      label: $t('erp.orderProcess.field.fabric'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_FABRIC, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.orderProcess.field.fabric'),
        ]),
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

/** 中间详情表单 schema（与 orderProcess/data.ts 的 useFormSchema 对齐） */
export function useDetailSchema(): VbenFormSchema[] {
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
      rules: 'required',
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
        showDescription: false,
        moduleType: MODULE_TYPE_ENUM.ERP,
        maxNumber: 8,
      },
      formItemClass: 'col-span-4',
    },
    /** 二维码 */
    {
      fieldName: 'qrCode',
      label: $t('erp.orderProcess.field.qrCode'),
      component: 'ImageUpload',
      formItemClass: 'col-span-4',
      componentProps: {
        showDescription: false,
        maxNumber: 1,
        moduleType: MODULE_TYPE_ENUM.ERP,
      },
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

/** 卡片字段定义 */
export type CardField = {
  /** 字典类型：指定后渲染时会用 getDictLabel 转成字典 label */
  dictType?: string;
  field: keyof OrderProcessApi.OrderProcess;
  label: string;
  span?: 1 | 2;
  type?: 'image' | 'text';
};

/** 左侧卡片展示字段 */
export const LEFT_CARD_FIELDS: ComputedRef<CardField[]> = computed(() => [
  {
    field: 'layoutPerson',
    label: $t('erp.orderProcess.field.layoutPerson'),
    span: 2,
  },
  {
    field: 'pattern',
    label: $t('erp.orderProcess.field.pattern'),
    dictType: DICT_TYPE.ERP_PATTERN,
  },
  {
    field: 'fabric',
    label: $t('erp.orderProcess.field.fabric'),
    dictType: DICT_TYPE.ERP_FABRIC,
  },
]);

/** 右侧卡片展示字段 */
export const RIGHT_CARD_FIELDS: ComputedRef<CardField[]> = computed(() => [
  {
    field: 'layoutPerson',
    label: $t('erp.orderProcess.field.layoutPerson'),
  },
  {
    field: 'pattern',
    label: $t('erp.orderProcess.field.pattern'),
    dictType: DICT_TYPE.ERP_PATTERN,
  },
  {
    field: 'category',
    label: $t('erp.orderProcess.field.category'),
    dictType: DICT_TYPE.ERP_CATEGORY,
  },
  {
    field: 'specification',
    label: $t('erp.orderProcess.field.specification'),
    dictType: DICT_TYPE.ERP_SPECIFICATION,
  },
  {
    field: 'hasForked',
    label: $t('erp.orderProcess.field.hasForked'),
    dictType: DICT_TYPE.ERP_HAS_FORKED,
  },
  {
    field: 'shirtHem',
    label: $t('erp.orderProcess.field.shirtHem'),
    dictType: DICT_TYPE.ERP_SHIRT_HEM,
  },
  {
    field: 'pocket',
    label: $t('erp.orderProcess.field.pocket'),
    dictType: DICT_TYPE.ERP_POCKET,
  },
  {
    field: 'neckline',
    label: $t('erp.orderProcess.field.neckline'),
    dictType: DICT_TYPE.ERP_NECKLINE,
  },
]);
