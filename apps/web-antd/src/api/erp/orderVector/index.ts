import type { AxiosRequestConfig, PageParam, PageResult } from '@vben/request';

import type { InfraFileApi } from '#/api/infra/file';

import { requestClient } from '#/api/request';

/** Axios 上传进度事件 */
export type AxiosProgressEvent = AxiosRequestConfig['onUploadProgress'];

export namespace OrderVectorApi {
  /** 订单向量信息 */
  export interface OrderVector {
    id: number; // 编号
    orderNo?: string; // 订单号
    vectorId?: string; // 向量编号
    imageUrl?: string; // 图片地址
  }

  /** 以图搜图相似结果（与 framework SearchResult 对齐） */
  export interface SearchResult {
    id: string;
    imagePath: string;
    fileId?: number;
    tenantId?: number;
    similarity: string;
    score: number;
    createTime: number;
  }
}

/** 查询订单向量分页 */
export function getOrderVectorPage(params: PageParam) {
  return requestClient.get<PageResult<OrderVectorApi.OrderVector>>(
    '/erp/order-vector/page',
    { params },
  );
}

/** 查询订单向量详情 */
export function getOrderVector(id: number) {
  return requestClient.get<OrderVectorApi.OrderVector>(
    `/erp/order-vector/get?id=${id}`,
  );
}

/** 新增订单向量 */
export function createOrderVector(data: OrderVectorApi.OrderVector) {
  return requestClient.post('/erp/order-vector/create', data);
}

/** 新增订单向量 */
export function resetOrderVector(data: OrderVectorApi.OrderVector) {
  return requestClient.post('/erp/order-vector/reset', data);
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
  return requestClient.delete(
    `/erp/order-vector/delete-list?ids=${ids.join(',')}`,
  );
}

/** 导出订单向量 */
export function exportOrderVector(params: OrderVectorApi.OrderVector) {
  return requestClient.download('/erp/order-vector/export-excel', {
    params,
    timeout: 30_000,
  });
}

/**
 * 订单向量以图搜图（按库内向量 id）
 * @param id  库内向量编号（erp_order_vector.vectorId）
 * @param topK Top K 返回条数
 */
export function searchOrderVectorById(id: string, topK = 100) {
  return requestClient.get<OrderVectorApi.SearchResult[]>(
    `/erp/order-vector/search?id=${encodeURIComponent(id)}&topK=${topK}`,
  );
}

/**
 * 订单向量以图搜图（按上传的图片）
 */
export function searchOrderVectorByUpload(
  data: InfraFileApi.FileUploadReqVO,
  topK = 100,
  onUploadProgress?: AxiosProgressEvent,
) {
  return requestClient.upload<OrderVectorApi.SearchResult[]>(
    '/erp/order-vector/search/upload',
    { ...data, topK },
    { onUploadProgress },
  );
}
