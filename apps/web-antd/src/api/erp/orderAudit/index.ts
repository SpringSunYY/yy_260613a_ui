import type { Dayjs } from 'dayjs';

import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace OrderAuditApi {
  /** 订单审核记录信息 */
  export interface OrderAudit {
    id: null | number; // 编号
    orderNo?: string; // 订单号
    oldAuditStatus?: string; // 原状态
    auditStatus?: string; // 审核状态
    auditRemark: string; // 审核意见
    creator?: string; // 创建人
    createTime: Dayjs | string;
  }

  /** 订单审核记录信息 */
  export interface OrderAuditDetail {
    id: null | number; // 编号
    orderNo?: string; // 订单号
    oldAuditStatus?: string; // 原状态
    auditStatus?: string; // 审核状态
    auditRemark: string; // 审核意见
    creator: string;
    avatar?: string; // 头像
    createTime: Dayjs | string;
  }
}

/** 查询订单审核记录分页 */
export function getOrderAuditPage(params: PageParam) {
  return requestClient.get<PageResult<OrderAuditApi.OrderAudit>>(
    '/erp/order-audit/page',
    { params },
  );
}

/** 查询订单审核记录详情 */
export function getOrderAudit(id: number) {
  return requestClient.get<OrderAuditApi.OrderAudit>(
    `/erp/order-audit/get?id=${id}`,
  );
}

/** 查询订单审核记录详情 */
export function getOrderAuditByNo(no: string) {
  return requestClient.get<OrderAuditApi.OrderAuditDetail[]>(
    `/erp/order-audit/get/no?no=${no}`,
  );
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
  return requestClient.delete(
    `/erp/order-audit/delete-list?ids=${ids.join(',')}`,
  );
}

/** 导出订单审核记录 */
export function exportOrderAudit(params: OrderAuditApi.OrderAudit) {
  return requestClient.download('/erp/order-audit/export-excel', {
    params,
    timeout: 30_000,
  });
}
