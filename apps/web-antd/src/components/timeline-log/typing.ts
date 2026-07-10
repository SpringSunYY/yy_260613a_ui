export interface TimelineLogItem {
  /** 唯一标识 */
  id: number | string;
  /** 操作时间 */
  createTime?: string | number | Date;
  /** 头像 URL */
  avatar?: string;
  /** 用户名（头像兜底显示首字） */
  userName?: string;
  /** 原始数据 */
  raw?: Record<string, any>;
}

export interface TimelineLogProps {
  /** 时间线数据列表 */
  logList: TimelineLogItem[];
}
