import type { PageParam, PageResult } from '@vben/request';
import type { Dayjs } from 'dayjs';

import { requestClient } from '#/api/request';

export namespace OrderAuditApi {
  /** 订单审核记录信息 */
  export interface OrderAudit {
    id: number; // 编号
    orderNo?: string; // 订单号
    oldAuditStatus?: string; // 原状态
    auditStatus?: string; // 审核状态
    auditPerson?: string; // 审核人
    auditTime?: string | Dayjs; // 审核时间
    auditRemark: string; // 审核意见
  }
}

/** 查询订单审核记录分页 */
export function getOrderAuditPage(params: PageParam) {
  return requestClient.get<PageResult<OrderAuditApi.OrderAudit>>('/erp/order-audit/page', { params });
}

/** 查询订单审核记录详情 */
export function getOrderAudit(id: number) {
  return requestClient.get<OrderAuditApi.OrderAudit>(`/erp/order-audit/get?id=${id}`);
}

/** 新增订单审核记录 */
export function createOrderAudit(data: OrderAuditApi.OrderAudit) {
  return requestClient.post('/erp/order-audit/create', data);
}

/** 修改订单审核记录 */
export function updateOrderAudit(data: OrderAuditApi.OrderAudit) {
  return requestClient.put('/erp/order-audit/update', data);
}

/** 删除订单审核记录 */
export function deleteOrderAudit(id: number) {
  return requestClient.delete(`/erp/order-audit/delete?id=${id}`);
}

/** 批量删除订单审核记录 */
export function deleteOrderAuditList(ids: number[]) {
  return requestClient.delete(`/erp/order-audit/delete-list?ids=${ids.join(',')}`)
}

/** 导出订单审核记录 */
export function exportOrderAudit(params: OrderAuditApi.OrderAudit) {
  return requestClient.download('/erp/order-audit/export-excel',
          {
            params,
            timeout:300_00
          });
}