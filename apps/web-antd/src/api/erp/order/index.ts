import type { Dayjs } from 'dayjs';

import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace OrderApi {
  /** 订单明细信息 */
  export interface OrderDetail {
    id: number; // 编号
    orderNo?: string; // 订单号
    setName: string; // 名字
    setNumber: string; // 号码
    setSize?: string; // 尺码
    setQuantity: number; // 数量
    remark: string; // 备注
  }

  /** 订单信息信息 */
  export interface Order {
    id: number; // 编号
    name?: string; // 订单名称
    orderNo?: string; // 订单号
    orderTime?: Dayjs | string; // 下单日期
    orderResource?: string; // 订单来源
    orderStatus?: string; // 订单状态
    auditStatus?: string; // 审核状态
    currentProcess?: string; // 当前工序
    shipmentTime: Dayjs | string; // 出货日期
    customer: string; // 客户
    orderImage: string; // 图片
    qrCode: string; // 二维码
    specification?: string; // 规格
    pattern: string; // 版型
    fabric?: string; // 布料
    number?: number; // 数量
    pickupMethod?: string; // 提货方式
    shippingAddress: string; // 发货地址
    exceptShippingTime?: Dayjs | string; // 预计发货时间
    shippingNo: string; // 发货订单
    shippingTime: Dayjs | string; // 发货时间
    printStatus?: string; // 打印状态
    hydration: string; // 补水
    remark: string; // 备注
    orderDetails?: OrderDetail[];
  }
}

/** 查询订单信息分页 */
export function getOrderPage(params: PageParam) {
  return requestClient.get<PageResult<OrderApi.Order>>('/erp/order/page', {
    params,
  });
}

/** 查询订单信息详情 */
export function getOrder(id: number) {
  return requestClient.get<OrderApi.Order>(`/erp/order/get?id=${id}`);
}

/** 新增订单信息 */
export function createOrder(data: OrderApi.Order) {
  return requestClient.post('/erp/order/create', data);
}

/** 修改订单信息 */
export function updateOrder(data: OrderApi.Order) {
  return requestClient.put('/erp/order/update', data);
}

/** 删除订单信息 */
export function deleteOrder(id: number) {
  return requestClient.delete(`/erp/order/delete?id=${id}`);
}

/** 批量删除订单信息 */
export function deleteOrderList(ids: number[]) {
  return requestClient.delete(`/erp/order/delete-list?ids=${ids.join(',')}`);
}

/** 导出订单信息 */
export function exportOrder(params: OrderApi.Order) {
  return requestClient.download('/erp/order/export-excel', {
    params,
    timeout: 30_000,
  });
}

// ==================== 子表（订单明细） ====================

/** 获得订单明细列表 */
export function getOrderDetailListByOrderNo(orderNo: string) {
  return requestClient.get<OrderApi.OrderDetail[]>(
    `/erp/order/order-detail/list-by-order-no?orderNo=${orderNo}`,
  );
}
