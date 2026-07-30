/** 单列定义 */
export interface ColumnDefinition {
  title: string;
  /** 宽度，可为像素（number）或百分比（string，如 '20%'） */
  width?: number | string;
  editable?: boolean;
  /** 字典类型（如 'erp_set_size'），设置后将自动加载字典选项作为下拉项 */
  dictType?: string;
  /** 直接传入下拉项（与 dictType 二选一，优先使用 dictType） */
  options?: { id: number | string; name: string }[];
  type?: 'dropdown' | 'numeric' | 'text';
}

export interface JspreadsheetProps {
  columns: ColumnDefinition[];
  data?: any[][];
  height?: number | string;
  minCols?: number;
  minRows?: number;
  /** 复制时是否包含表头，默认 true */
  copyWithHeader?: boolean;
  onChange?: (instance: any, data: any[][]) => void;
  onLoaded?: (instance: any) => void;
}

/** 运行时实例 */
export interface JspreadsheetInstance {
  getData: () => any[][];
  setData: (data: any[][]) => void;
  insertRow: () => void;
  jexcel: any;
}

/** 组件 props */
export interface JspreadsheetProps {
  columns: ColumnDefinition[];
  data?: any[][];
  height?: number | string;
  minCols?: number;
  minRows?: number;
  /** 数据变更回调 */
  onChange?: (instance: JspreadsheetInstance, data: any[][]) => void;
  /** 加载完成回调 */
  onLoaded?: (instance: JspreadsheetInstance) => void;
}

/** 组件 emits */
export interface JspreadsheetEmits {
  (e: 'change', instance: JspreadsheetInstance, data: any[][]): void;
  (e: 'loaded', instance: JspreadsheetInstance): void;
}
