import type { PageParam, PageResult } from '@vben/request';
import type { Dayjs } from 'dayjs';

import { requestClient } from '#/api/request';

export namespace OrderProcessApi {
  /** 订单工序信息 */
  export interface OrderProcess {
    id: number; // 编号
    currentProcess?: string; // 当前工序
    orderNo?: string; // 订单号
    layoutPerson: string; // 排版人
    orderImage: string; // 图片
    qrCode: string; // 二维码
    pattern: string; // 版型
    fabric?: string; // 布料
    category?: string; // 品类
    specification?: string; // 规格
    hasForked?: string; // 开叉与否
    shirtHem?: string; // 衫脚
    pocket?: string; // 口袋
    neckline?: string; // 领口
    packagingRequirements: string; // 包装要求
    workshopRequirements: string; // 车间要求
    remark: string; // 特别备注
  }
}

/** 查询订单工序分页 */
export function getOrderProcessPage(params: PageParam) {
  return requestClient.get<PageResult<OrderProcessApi.OrderProcess>>('/erp/order-process/page', { params });
}

/** 查询订单工序详情 */
export function getOrderProcess(id: number) {
  return requestClient.get<OrderProcessApi.OrderProcess>(`/erp/order-process/get?id=${id}`);
}

/** 新增订单工序 */
export function createOrderProcess(data: OrderProcessApi.OrderProcess) {
  return requestClient.post('/erp/order-process/create', data);
}

/** 修改订单工序 */
export function updateOrderProcess(data: OrderProcessApi.OrderProcess) {
  return requestClient.put('/erp/order-process/update', data);
}

/** 删除订单工序 */
export function deleteOrderProcess(id: number) {
  return requestClient.delete(`/erp/order-process/delete?id=${id}`);
}

/** 批量删除订单工序 */
export function deleteOrderProcessList(ids: number[]) {
  return requestClient.delete(`/erp/order-process/delete-list?ids=${ids.join(',')}`)
}

/** 导出订单工序 */
export function exportOrderProcess(params: OrderProcessApi.OrderProcess) {
  return requestClient.download('/erp/order-process/export-excel',
          {
            params,
            timeout:300_00
          });
}