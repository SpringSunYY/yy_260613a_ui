import type { PageParam, PageResult } from '@vben/request';
import type { Dayjs } from 'dayjs';

import { requestClient } from '#/api/request';

export namespace OrderProcessHistoryApi {
  /** 订单工序记录信息 */
  export interface OrderProcessHistory {
    id: number; // 编号
    orderNo?: string; // 订单号
    oldProcess: string; // 原工序
    currentProcess?: string; // 当前工序
  }
}

/** 查询订单工序记录分页 */
export function getOrderProcessHistoryPage(params: PageParam) {
  return requestClient.get<PageResult<OrderProcessHistoryApi.OrderProcessHistory>>('/erp/order-process-history/page', { params });
}

/** 查询订单工序记录详情 */
export function getOrderProcessHistory(id: number) {
  return requestClient.get<OrderProcessHistoryApi.OrderProcessHistory>(`/erp/order-process-history/get?id=${id}`);
}

/** 新增订单工序记录 */
export function createOrderProcessHistory(data: OrderProcessHistoryApi.OrderProcessHistory) {
  return requestClient.post('/erp/order-process-history/create', data);
}

/** 修改订单工序记录 */
export function updateOrderProcessHistory(data: OrderProcessHistoryApi.OrderProcessHistory) {
  return requestClient.put('/erp/order-process-history/update', data);
}

/** 删除订单工序记录 */
export function deleteOrderProcessHistory(id: number) {
  return requestClient.delete(`/erp/order-process-history/delete?id=${id}`);
}

/** 批量删除订单工序记录 */
export function deleteOrderProcessHistoryList(ids: number[]) {
  return requestClient.delete(`/erp/order-process-history/delete-list?ids=${ids.join(',')}`)
}

/** 导出订单工序记录 */
export function exportOrderProcessHistory(params: OrderProcessHistoryApi.OrderProcessHistory) {
  return requestClient.download('/erp/order-process-history/export-excel',
          {
            params,
            timeout:300_00
          });
}