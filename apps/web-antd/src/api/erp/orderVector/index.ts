import type { PageParam, PageResult } from '@vben/request';
import type { Dayjs } from 'dayjs';

import { requestClient } from '#/api/request';

export namespace OrderVectorApi {
  /** 订单向量信息 */
  export interface OrderVector {
    id: number; // 编号
    orderNo?: string; // 订单号
    vectorId?: string; // 向量编号
    imageUrl?: string; // 图片地址
  }
}

/** 查询订单向量分页 */
export function getOrderVectorPage(params: PageParam) {
  return requestClient.get<PageResult<OrderVectorApi.OrderVector>>('/erp/order-vector/page', { params });
}

/** 查询订单向量详情 */
export function getOrderVector(id: number) {
  return requestClient.get<OrderVectorApi.OrderVector>(`/erp/order-vector/get?id=${id}`);
}

/** 新增订单向量 */
export function createOrderVector(data: OrderVectorApi.OrderVector) {
  return requestClient.post('/erp/order-vector/create', data);
}

/** 修改订单向量 */
export function updateOrderVector(data: OrderVectorApi.OrderVector) {
  return requestClient.put('/erp/order-vector/update', data);
}

/** 删除订单向量 */
export function deleteOrderVector(id: number) {
  return requestClient.delete(`/erp/order-vector/delete?id=${id}`);
}

/** 批量删除订单向量 */
export function deleteOrderVectorList(ids: number[]) {
  return requestClient.delete(`/erp/order-vector/delete-list?ids=${ids.join(',')}`)
}

/** 导出订单向量 */
export function exportOrderVector(params: OrderVectorApi.OrderVector) {
  return requestClient.download('/erp/order-vector/export-excel',
          {
            params,
            timeout:300_00
          });
}