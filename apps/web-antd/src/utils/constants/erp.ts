// ========== ERP - 企业资源计划 ==========

export const ErpOrderAuditStatus = {
  /** 草稿 */
  ORDER_AUDIT_STATUS_1: '1',

  /** 待审核 */
  ORDER_AUDIT_STATUS_2: '2',

  /** 同意 */
  ORDER_AUDIT_STATUS_3: '3',

  /** 拒绝 */
  ORDER_AUDIT_STATUS_4: '4',
} as const;

// 订单当前工序
export const ErpOrderCurrentProcess = {
  /** 草稿 */
  CURRENT_PROCESS_1: '1',

  /** 待排版 */
  CURRENT_PROCESS_2: '2',

  /** 待打纸 */
  CURRENT_PROCESS_3: '3',

  /** 待滚筒 */
  CURRENT_PROCESS_4: '4',

  /** 待激光 */
  CURRENT_PROCESS_5: '5',

  /** 待裁缝发货 */
  CURRENT_PROCESS_6: '6',

  /** 完结 */
  CURRENT_PROCESS_7: '7',
} as const;
