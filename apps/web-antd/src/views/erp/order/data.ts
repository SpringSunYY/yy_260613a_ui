import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OrderApi } from '#/api/erp/order';

import { useAccess } from '@vben/access';
import { $t } from '@vben/locales';

import {
  DICT_TYPE,
  ErpOrderAuditStatus,
  getDictOptions,
  getRangePickerDefaultProps,
} from '#/utils';

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
    /** 订单名称 */
    {
      fieldName: 'name',
      label: $t('erp.order.field.name'),
      rules: 'required',
      component: 'Input',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [$t('erp.order.field.name')]),
      },
    },
    /** 订单号 */
    {
      fieldName: 'orderNo',
      label: $t('erp.order.field.orderNo'),
      rules: 'required',
      component: 'Input',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.order.field.orderNo'),
        ]),
      },
    },
    /** 下单日期 */
    {
      fieldName: 'orderTime',
      label: $t('erp.order.field.orderTime'),
      rules: 'required',
      component: 'DatePicker',
      componentProps: {
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        valueFormat: 'x',
      },
    },
    /** 订单来源 */
    {
      fieldName: 'orderResource',
      label: $t('erp.order.field.orderResource'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_RESOURCE, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.orderResource'),
        ]),
      },
    },
    /** 订单状态 */
    {
      fieldName: 'orderStatus',
      label: $t('erp.order.field.orderStatus'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_STATUS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.orderStatus'),
        ]),
      },
    },
    /** 审核状态 */
    /*    {
      fieldName: 'auditStatus',
      label: $t('erp.order.field.auditStatus'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_AUDIT_STATUS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.auditStatus'),
        ]),
      },
    },*/
    /** 当前工序 */
    /*    {
      fieldName: 'currentProcess',
      label: $t('erp.order.field.currentProcess'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.currentProcess'),
        ]),
      },
    },*/
    /** 出货日期 */
    /*    {
      fieldName: 'shipmentTime',
      label: $t('erp.order.field.shipmentTime'),
      component: 'DatePicker',
      componentProps: {
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        valueFormat: 'x',
      },

    },*/
    /** 客户 */
    {
      fieldName: 'customer',
      label: $t('erp.order.field.customer'),
      component: 'Input',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.order.field.customer'),
        ]),
      },
    },
    /** 图片 */
    /* {
      fieldName: 'orderImage',
      label: $t('erp.order.field.orderImage'),
      component: 'ImageUpload',
      componentProps: {
        moduleType: 'erp',
      },
    },*/
    /** 二维码 */
    /*  {
      fieldName: 'qrCode',
      label: $t('erp.order.field.qrCode'),
      component: 'ImageUpload',
      componentProps: {
        moduleType: 'erp',
      },
    },*/
    /** 规格 */
    /*  {
      fieldName: 'specification',
      label: $t('erp.order.field.specification'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_SPECIFICATION, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.specification'),
        ]),
      },
    },*/
    /** 版型 */
    /* {
      fieldName: 'pattern',
      label: $t('erp.order.field.pattern'),
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_PATTERN, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.pattern'),
        ]),
      },
    },*/
    /** 布料 */
    /*  {
      fieldName: 'fabric',
      label: $t('erp.order.field.fabric'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_FABRIC, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.fabric'),
        ]),
      },
    },*/
    /** 数量 */
    {
      fieldName: 'number',
      label: $t('erp.order.field.number'),
      rules: 'required',
      component: 'InputNumber',
      componentProps: {
        min: 0,
        controlsPosition: 'right',
        placeholder: $t('ui.placeholder.input', [$t('erp.order.field.number')]),
        readonly: true,
      },
      defaultValue: 0,
    },
    /** 提货方式 */
    {
      fieldName: 'pickupMethod',
      label: $t('erp.order.field.pickupMethod'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_PICKUP_METHOD, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.pickupMethod'),
        ]),
      },
    },
    /** 发货地址 */
    {
      fieldName: 'shippingAddress',
      label: $t('erp.order.field.shippingAddress'),
      component: 'Input',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.order.field.shippingAddress'),
        ]),
      },
    },
    /** 预计发货时间 */
    {
      fieldName: 'exceptShippingTime',
      label: $t('erp.order.field.exceptShippingTime'),
      rules: 'required',
      component: 'DatePicker',
      componentProps: {
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        valueFormat: 'x',
      },
    },
    /** 发货订单 */
    {
      fieldName: 'shippingNo',
      label: $t('erp.order.field.shippingNo'),
      component: 'Input',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.order.field.shippingNo'),
        ]),
      },
    },
    /** 发货时间 */
    /* {
      fieldName: 'shippingTime',
      label: $t('erp.order.field.shippingTime'),
      component: 'DatePicker',
      componentProps: {
        showTime: true,
        format: 'YYYY-MM-DD HH:mm:ss',
        valueFormat: 'x',
      },
    },*/
    /** 打印状态 */
    /* {
      fieldName: 'printStatus',
      label: $t('erp.order.field.printStatus'),
      rules: 'required',
      component: 'I18nSelect',
      componentProps: {
        options: getDictOptions(DICT_TYPE.ERP_ORDER_PRINT_STATUS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.printStatus'),
        ]),
      },
    },*/
    /** 补水 */
    {
      fieldName: 'hydration',
      label: $t('erp.order.field.hydration'),
      component: 'Input',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [
          $t('erp.order.field.hydration'),
        ]),
      },
    },
    /** 备注 */
    {
      fieldName: 'remark',
      label: $t('erp.order.field.remark'),
      component: 'Textarea',
      componentProps: {
        placeholder: $t('ui.placeholder.input', [$t('erp.order.field.remark')]),
      },
      formItemClass: 'col-span-3',
    },
  ];
}

/** 列表的搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    /** 订单名称 */
    {
      fieldName: 'name',
      label: $t('erp.order.field.name'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [$t('erp.order.field.name')]),
      },
    },
    /** 订单号 */
    {
      fieldName: 'orderNo',
      label: $t('erp.order.field.orderNo'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.order.field.orderNo'),
        ]),
      },
    },
    /** 下单日期 */
    {
      fieldName: 'orderTime',
      label: $t('erp.order.field.orderTime'),
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    /** 订单来源 */
    {
      fieldName: 'orderResource',
      label: $t('erp.order.field.orderResource'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_RESOURCE, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.orderResource'),
        ]),
      },
    },
    /** 订单状态 */
    {
      fieldName: 'orderStatus',
      label: $t('erp.order.field.orderStatus'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_STATUS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.orderStatus'),
        ]),
      },
    },
    /** 审核状态 */
    {
      fieldName: 'auditStatus',
      label: $t('erp.order.field.auditStatus'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_AUDIT_STATUS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.auditStatus'),
        ]),
      },
    },
    /** 当前工序 */
    {
      fieldName: 'currentProcess',
      label: $t('erp.order.field.currentProcess'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_CURRENT_PROCESS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.currentProcess'),
        ]),
      },
    },
    /** 出货日期 */
    {
      fieldName: 'shipmentTime',
      label: $t('erp.order.field.shipmentTime'),
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    /** 客户 */
    {
      fieldName: 'customer',
      label: $t('erp.order.field.customer'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.order.field.customer'),
        ]),
      },
    },
    /** 规格 */
    {
      fieldName: 'specification',
      label: $t('erp.order.field.specification'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_SPECIFICATION, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.specification'),
        ]),
      },
    },
    /** 版型 */
    {
      fieldName: 'pattern',
      label: $t('erp.order.field.pattern'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_PATTERN, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.pattern'),
        ]),
      },
    },
    /** 布料 */
    {
      fieldName: 'fabric',
      label: $t('erp.order.field.fabric'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_FABRIC, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.fabric'),
        ]),
      },
    },
    /** 数量 */
    {
      fieldName: 'number',
      label: $t('erp.order.field.number'),
      component: 'NumberRange',
    },
    /** 提货方式 */
    {
      fieldName: 'pickupMethod',
      label: $t('erp.order.field.pickupMethod'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_PICKUP_METHOD, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.pickupMethod'),
        ]),
      },
    },
    /** 预计发货时间 */
    {
      fieldName: 'exceptShippingTime',
      label: $t('erp.order.field.exceptShippingTime'),
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    /** 发货订单 */
    {
      fieldName: 'shippingNo',
      label: $t('erp.order.field.shippingNo'),
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('ui.placeholder.input', [
          $t('erp.order.field.shippingNo'),
        ]),
      },
    },
    /** 发货时间 */
    {
      fieldName: 'shippingTime',
      label: $t('erp.order.field.shippingTime'),
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    /** 打印状态 */
    {
      fieldName: 'printStatus',
      label: $t('erp.order.field.printStatus'),
      component: 'I18nSelect',
      componentProps: {
        allowClear: true,
        options: getDictOptions(DICT_TYPE.ERP_ORDER_PRINT_STATUS, 'string'),
        placeholder: $t('ui.placeholder.select', [
          $t('erp.order.field.printStatus'),
        ]),
      },
    },
    /** 创建时间 */
    {
      fieldName: 'createTime',
      label: $t('erp.order.field.createTime'),
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
  ];
}

/** 列表的字段 */
export function useGridColumns(): VxeTableGridOptions<OrderApi.Order>['columns'] {
  return [
    { type: 'checkbox', width: 40 },
    /** 编号 */
    {
      field: 'id',
      title: $t('erp.order.field.id'),
      minWidth: 120,
      visible: false,
    },
    /** 订单名称 */
    {
      field: 'name',
      title: $t('erp.order.field.name'),
      minWidth: 120,
    },
    /** 订单号 */
    {
      field: 'orderNo',
      title: $t('erp.order.field.orderNo'),
      minWidth: 120,
    },
    /** 下单日期 */
    {
      field: 'orderTime',
      title: $t('erp.order.field.orderTime'),
      minWidth: 120,
      sortable: true,
      formatter: 'formatDateTime',
    },
    /** 订单来源 */
    {
      field: 'orderResource',
      title: $t('erp.order.field.orderResource'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_RESOURCE },
      },
    },
    /** 订单状态 */
    {
      field: 'orderStatus',
      title: $t('erp.order.field.orderStatus'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_STATUS },
      },
    },
    /** 审核状态 */
    {
      field: 'auditStatus',
      title: $t('erp.order.field.auditStatus'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_AUDIT_STATUS },
      },
    },
    /** 当前工序 */
    {
      field: 'currentProcess',
      title: $t('erp.order.field.currentProcess'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_CURRENT_PROCESS },
      },
    },
    /** 出货日期 */
    {
      field: 'shipmentTime',
      title: $t('erp.order.field.shipmentTime'),
      minWidth: 120,
      sortable: true,
      formatter: 'formatDateTime',
      visible: false,
    },
    /** 客户 */
    {
      field: 'customer',
      title: $t('erp.order.field.customer'),
      minWidth: 120,
    },
    /** 图片 */
    {
      field: 'orderImage',
      title: $t('erp.order.field.orderImage'),
      minWidth: 120,
      cellRender: {
        name: 'CellImage',
        props: {
          width: 40,
          height: 40,
        },
      },
    },
    /** 二维码 */
    {
      field: 'qrCode',
      title: $t('erp.order.field.qrCode'),
      minWidth: 120,
      visible: false,
      cellRender: {
        name: 'CellImage',
        props: {
          width: 40,
          height: 40,
        },
      },
    },
    /** 规格 */
    {
      field: 'specification',
      title: $t('erp.order.field.specification'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_SPECIFICATION },
      },
    },
    /** 版型 */
    {
      field: 'pattern',
      title: $t('erp.order.field.pattern'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_PATTERN },
      },
    },
    /** 布料 */
    {
      field: 'fabric',
      title: $t('erp.order.field.fabric'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_FABRIC },
      },
    },
    /** 数量 */
    {
      field: 'number',
      title: $t('erp.order.field.number'),
      minWidth: 120,
      sortable: true,
    },
    /** 提货方式 */
    {
      field: 'pickupMethod',
      title: $t('erp.order.field.pickupMethod'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_PICKUP_METHOD },
      },
    },
    /** 发货地址 */
    {
      field: 'shippingAddress',
      title: $t('erp.order.field.shippingAddress'),
      minWidth: 120,
      visible: false,
    },
    /** 预计发货时间 */
    {
      field: 'exceptShippingTime',
      title: $t('erp.order.field.exceptShippingTime'),
      minWidth: 120,
      sortable: true,
      formatter: 'formatDateTime',
      visible: false,
    },
    /** 发货订单 */
    {
      field: 'shippingNo',
      title: $t('erp.order.field.shippingNo'),
      minWidth: 120,
      visible: false,
    },
    /** 发货时间 */
    {
      field: 'shippingTime',
      title: $t('erp.order.field.shippingTime'),
      minWidth: 120,
      sortable: true,
      formatter: 'formatDateTime',
      visible: false,
    },
    /** 打印状态 */
    {
      field: 'printStatus',
      title: $t('erp.order.field.printStatus'),
      minWidth: 120,
      cellRender: {
        name: 'CellI18nDict',
        props: { type: DICT_TYPE.ERP_ORDER_PRINT_STATUS },
      },
    },
    /** 补水 */
    {
      field: 'hydration',
      title: $t('erp.order.field.hydration'),
      minWidth: 120,
    },
    /** 备注 */
    {
      field: 'remark',
      title: $t('erp.order.field.remark'),
      minWidth: 120,
    },
    /** 创建人*/
    {
      field: 'creator',
      title: $t('erp.order.field.creator'),
      minWidth: 120,
      visible: false,
    },
    /** 创建时间 */
    {
      field: 'createTime',
      title: $t('erp.order.field.createTime'),
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

// ==================== 子表（订单明细） ====================

/** 新增/修改列表的字段 */
export function useOrderDetailGridEditColumns(
  onActionClick?: OnActionClickFn<OrderApi.OrderDetail>,
): VxeTableGridOptions<OrderApi.OrderDetail>['columns'] {
  return [
    /** 名字 */
    {
      field: 'setName',
      title: $t('erp.orderDetail.field.setName'),
      minWidth: 120,
      slots: { default: 'setName' },
    },
    /** 号码 */
    {
      field: 'setNumber',
      title: $t('erp.orderDetail.field.setNumber'),
      minWidth: 120,
      slots: { default: 'setNumber' },
    },
    /** 尺码 */
    {
      field: 'setSize',
      title: $t('erp.orderDetail.field.setSize'),
      minWidth: 120,
      slots: { default: 'setSize' },
      params: {
        options: getDictOptions(DICT_TYPE.ERP_SET_SIZE, 'string'),
      },
    },
    /** 数量 */
    {
      field: 'setQuantity',
      title: $t('erp.orderDetail.field.setQuantity'),
      minWidth: 120,
      slots: { default: 'setQuantity' },
    },
    /** 备注 */
    {
      field: 'remark',
      title: $t('erp.orderDetail.field.remark'),
      minWidth: 120,
      slots: { default: 'remark' },
    },
    {
      field: 'operation',
      title: $t('common.operation'),
      width: 200,
      align: 'center',
      fixed: 'right',
      showOverflow: false,
      cellRender: {
        attrs: {
          nameField: 'id',
          nameTitle: $t('erp.orderDetail.orderDetail'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'delete',
            show: hasAccessByCodes(['erp:order:delete']),
          },
        ],
      },
    },
  ];
}

/** 新增/修改的表单 */
export function useAuditFormSchema(): VbenFormSchema[] {
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
    /** 审核状态 */
    {
      fieldName: 'auditStatus',
      label: $t('erp.orderAudit.field.auditStatus'),
      rules: 'required',
      component: 'I18nRadioGroup',
      componentProps: {
        options: getDictOptions(
          DICT_TYPE.ERP_ORDER_AUDIT_STATUS,
          'string',
        ).filter(
          (item) =>
            item.value !== ErpOrderAuditStatus.ORDER_AUDIT_STATUS_1 &&
            item.value !== ErpOrderAuditStatus.ORDER_AUDIT_STATUS_2,
        ),
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
        placeholder: $t('ui.placeholder.input', [
          $t('erp.orderAudit.field.auditRemark'),
        ]),
      },
    },
  ];
}
