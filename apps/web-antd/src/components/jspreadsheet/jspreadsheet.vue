<!-- Jspreadsheet CE 封装组件 用于订单明细等需要 Excel 风格复制粘贴的场景
特性列数锁定为 props.columns.length，禁止新增/删除列、禁止列拖拽排序
通过 dictType 字段在组件内部自动加载字典选项使用 jspreadsheet 原生
dropdown（tableOverflow:true → position:true 自动脱离容器）数量列通过
onbeforechange 校验只接受数字，空值允许 使用 jspreadsheet v5 原生的
options.onchange / options.onload 等回调 -->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import jspreadsheet from 'jspreadsheet-ce';

import { getDictOptions } from '#/utils';

import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';

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

export interface JspreadsheetInstance {
  getData: () => any[][];
  setData: (data: any[][]) => void;
  insertRow: () => void;
  jexcel: any;
}

const props = withDefaults(
  defineProps<{
    columns: ColumnDefinition[];
    data?: any[][];
    height?: number | string;
    minCols?: number;
    minRows?: number;
    onChange?: (instance: JspreadsheetInstance, data: any[][]) => void;
    onLoaded?: (instance: JspreadsheetInstance) => void;
  }>(),
  {
    data: () => [],
    minRows: 8,
    minCols: 8,
    height: 300,
  },
);

const emit = defineEmits<{
  (e: 'update:data', data: any[][]): void;
}>();

const containerRef = ref<HTMLDivElement>();
/** Spreadsheet 实例（顶层） */
let spreadsheetInstance: any = null;
/** Worksheet 实例 */
let worksheetInstance: any = null;
/** 已销毁标志 */
let destroyed = false;

const mergedHeight = computed(() => {
  if (typeof props.height === 'number') {
    return `${props.height}px`;
  }
  return props.height || '300px';
});

/** 索引：哪些列是 numeric 类型，用于 onbeforechange 时做数字校验 */
const numericColumnIndexes = computed(() => {
  const list: number[] = [];
  props.columns.forEach((c, idx) => {
    if (c.type === 'numeric') list.push(idx);
  });
  return list;
});

/** 解析某一列的下拉项为字符串数组（jspreadsheet source 接受 string[]） */
function resolveDropdownSource(col: ColumnDefinition): string[] {
  if (col.type !== 'dropdown') return [];
  if (col.dictType) {
    const opts = getDictOptions(col.dictType, 'string');
    return opts.map((opt) => String(opt.label));
  }
  if (col.options) {
    return col.options.map((opt) => String(opt.name));
  }
  return [];
}

/** 构建列配置 */
function buildColumns(): any[] {
  return props.columns.map((col) => {
    const config: any = {
      title: col.title,
      width: col.width || 120,
      align: 'center',
    };
    if (col.type === 'dropdown') {
      config.type = 'dropdown';
      config.source = resolveDropdownSource(col);
    } else if (col.type === 'numeric') {
      config.type = 'numeric';
      // decimal 用于格式化显示；不限制输入，而是由 onbeforechange 做最终拦截
      config.decimal = '.';
      // mask 不强制，否则部分输入法会报错
    } else {
      config.type = 'text';
    }
    return config;
  });
}

/** 规范化一行数据 */
function normalizeRow(row: any[] | undefined, length: number): any[] {
  const result: any[] = new Array(length).fill('');
  if (row) {
    for (let i = 0; i < length; i++) {
      result[i] = row[i] ?? '';
    }
  }
  return result;
}

/** 规范化二维数据 */
function normalizeData(data: any[][]): any[][] {
  const colCount = props.columns.length;
  return data.map((row) => normalizeRow(row, colCount));
}

/** 获取对外暴露的实例 */
function getInstance(): JspreadsheetInstance {
  return {
    getData: () => worksheetInstance?.getData?.() ?? [],
    setData: (data: any[][]) => {
      if (worksheetInstance) {
        worksheetInstance.setData(normalizeData(data));
      }
    },
    insertRow: () => worksheetInstance?.insertRow?.(),
    jexcel: worksheetInstance,
  };
}

/** 把当前数据推给外部 */
function emitChange(data: any[][] | null = null) {
  if (destroyed) return;
  const finalData = data ?? worksheetInstance?.getData?.() ?? [];
  if (props.onChange) {
    props.onChange(getInstance(), finalData);
  }
  emit('update:data', finalData);
}

/** 强制列数锁定 */
function lockColumns() {
  if (destroyed || !worksheetInstance) return;
  const expected = props.columns.length;
  const actual = worksheetInstance.options?.columns?.length ?? 0;
  if (actual <= expected) return;
  try {
    for (let i = actual - 1; i >= expected; i--) {
      try {
        worksheetInstance.deleteColumn?.(i);
      } catch {}
    }
  } catch (error) {
    console.warn('lockColumns failed', error);
  }
}

/**
 * 把任意输入归一化为数字或空字符串。
 * - 允许空字符串（视为清空）
 * - 数字（含小数）通过
 * - 字符串中只提取数字部分
 * - 其余拒绝（返回空）
 */
function normalizeNumericInput(value: any): '' | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const str = String(value).trim();
  if (str === '') return '';
  // 提取首个数字串（含小数点）
  const match = str.match(/-?\d+(\.\d+)?/);
  if (match) {
    const n = Number.parseFloat(match[0]);
    if (!Number.isNaN(n)) return n;
  }
  return '';
}

/** 初始化 jspreadsheet */
function init() {
  if (!containerRef.value) return;

  // 销毁旧实例
  if (spreadsheetInstance) {
    try {
      spreadsheetInstance.destroy?.();
    } catch {}
    spreadsheetInstance = null;
    worksheetInstance = null;
  }
  containerRef.value.innerHTML = '';

  const columns = buildColumns();
  const data = normalizeData(props.data || []);
  const colCount = props.columns.length || props.minCols;
  const numericCols = new Set(numericColumnIndexes.value);

  const options: any = {
    worksheets: [
      {
        data,
        columns,
        minDimensions: [colCount, props.minRows] as [number, number],
      },
    ],
    tableOverflow: true,
    tableWidth: '100%',
    tableHeight: mergedHeight.value,
    copyCompatibility: true,
    toolbar: false,
    search: false,
    pagination: false,
    allowDeleteRow: true,
    allowInsertRow: false,
    allowDeleteColumn: false,
    allowInsertColumn: false,
    columnSorting: false,
    columnDrag: false,
    columnResize: false,
    freezeColumns: 0,
    columnAlignment: 'center',

    // ============== v5 关键：用 options 回调替代 .on() ==============
    onload: (instance: any) => {
      if (destroyed) return;
      spreadsheetInstance = instance;
      worksheetInstance = instance?.worksheets?.[0] ?? null;
      console.log(
        '[Jspreadsheet] onload, worksheets:',
        instance?.worksheets?.length,
      );
      hideTopBar();

      // 列宽自适应：用 ResizeObserver 动态缩放表格填满父容器
      nextTick(() => {
        // 找到 jspreadsheet 根容器（.jss_spreadsheet）
        const spreadsheetEl = worksheetInstance?.el?.closest(
          '.jss_spreadsheet',
        ) as HTMLElement | null;
        if (spreadsheetEl) {
          // 内部 table 需要 scale
          const tableEl = spreadsheetEl.querySelector(
            'table',
          ) as HTMLElement | null;
          if (!tableEl) return;

          const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const containerWidth = entry.contentRect.width;
              const tableWidth = tableEl.scrollWidth || 800;
              if (containerWidth > 0 && tableWidth > containerWidth) {
                const scale = containerWidth / tableWidth;
                tableEl.style.transform = `scaleX(${scale})`;
                tableEl.style.transformOrigin = 'left top';
                tableEl.style.width = `${tableWidth}px`;
                tableEl.style.maxWidth = 'none';
              } else {
                tableEl.style.transform = '';
                tableEl.style.width = '';
                tableEl.style.maxWidth = '';
              }
            }
          });
          observer.observe(spreadsheetEl);
          // 记录 observer 引用以便卸载
          (instance as any).__resizeObserver = observer;
        }
      });

      if (props.onLoaded && worksheetInstance) {
        props.onLoaded(getInstance());
      }
    },
    /**
     * 写入前的最后一道拦截：
     *  - numeric 列：只接受数字；空字符串放行；其他清空
     *  - dropdown 列：只接受 source 中的项；无效值（包括 undefined）拒绝
     */
    onbeforechange: (
      _instance: any,
      _cell: HTMLTableCellElement,
      colIndex: number | string,
      _rowIndex: number | string,
      newValue: any,
    ) => {
      if (newValue === undefined || newValue === null) {
        return ''; // 拒绝 jspreadsheet 内部发出的"幽灵" undefined 值
      }
      const cIdx = Number(colIndex);
      if (numericCols.has(cIdx)) {
        const normalized = normalizeNumericInput(newValue);
        return normalized === '' && newValue === '' ? undefined : normalized;
      }
      // dropdown 列：必须是字符串且非空（具体值由 jSuites dropdown 内部已保证）
      if (typeof newValue === 'string') {
        return newValue === '' ? undefined : newValue;
      }
      // 其他类型（非字符串）：拒绝
      return '';
    },
    // 单元格值变化（包括输入和粘贴）
    onchange: (
      _instance: any,
      _cell: HTMLTableCellElement,
      colIndex: number | string,
      rowIndex: number | string,
      newValue: any,
      oldValue: any,
    ) => {
      // 忽略幽灵 onchange（jspreadsheet 内部会在某些路径上发出 undefined 值的 onchange）
      if (newValue === undefined || newValue === null) {
        console.log('[Jspreadsheet] onchange ignored (ghost)', {
          colIndex,
          rowIndex,
          newValue,
          oldValue,
        });
        return;
      }
      // 忽略值未变化的情况
      if (newValue === oldValue) {
        console.log('[Jspreadsheet] onchange ignored (no-op)', {
          colIndex,
          rowIndex,
          newValue,
        });
        return;
      }
      console.log('[Jspreadsheet] onchange', { colIndex, rowIndex, newValue });
      const data = worksheetInstance?.getData?.() ?? [];
      emitChange(data);
    },
    // 粘贴完成后
    onpaste: (_instance: any) => {
      lockColumns();
      const data = worksheetInstance?.getData?.() ?? [];
      emitChange(data);
    },
    oninsertrow: () => {
      const data = worksheetInstance?.getData?.() ?? [];
      emitChange(data);
    },
    ondeleterow: () => {
      const data = worksheetInstance?.getData?.() ?? [];
      emitChange(data);
    },
    onbeforeinsertcolumn: () => false,
    oninsertcolumn: () => {
      lockColumns();
      const data = worksheetInstance?.getData?.() ?? [];
      emitChange(data);
    },
    onbeforedeletecolumn: () => false,
    ondeletecolumn: () => {
      const data = worksheetInstance?.getData?.() ?? [];
      emitChange(data);
    },
  };

  try {
    jspreadsheet(containerRef.value, options);
  } catch (error) {
    console.error('jspreadsheet 初始化失败', error);
  }
}

/** 隐藏顶部 tab 栏 */
function hideTopBar() {
  nextTick(() => {
    if (!containerRef.value) return;
    const headerBars = containerRef.value.querySelectorAll(
      '.jexcel > div:first-child',
    );
    for (const bar of headerBars) {
      const el = bar as HTMLElement;
      const text = (el.textContent ?? '').trim();
      if (!text || el.querySelector('.jtab')) {
        el.style.display = 'none';
      }
    }
    const tabs = containerRef.value.querySelectorAll('.jtab');
    for (const tab of tabs) {
      (tab as HTMLElement).style.display = 'none';
    }
    const footers = containerRef.value.querySelectorAll('.jexcel_footer');
    for (const footer of footers) {
      (footer as HTMLElement).style.display = 'none';
    }
  });
}

/** 对外暴露：设置数据 */
function setData(data: any[][]) {
  if (worksheetInstance && data) {
    worksheetInstance.setData(normalizeData(data));
    nextTick(() => lockColumns());
    emitChange(normalizeData(data));
  }
}

/** 对外暴露：重置数据 */
function resetData() {
  if (worksheetInstance) {
    worksheetInstance.setData([]);
    emitChange([]);
  }
}

onMounted(() => {
  init();
});

onUnmounted(() => {
  destroyed = true;
  if (spreadsheetInstance) {
    try {
      spreadsheetInstance.destroy?.();
    } catch {}
    // 清理 ResizeObserver
    const observer = (spreadsheetInstance as any).__resizeObserver;
    if (observer) observer.disconnect();
    spreadsheetInstance = null;
    worksheetInstance = null;
  }
});

// 外部 props.data 变化时同步到 jspreadsheet
watch(
  () => props.data,
  (newData) => {
    if (newData && worksheetInstance) {
      worksheetInstance.setData(normalizeData(newData));
      nextTick(() => lockColumns());
    }
  },
  { deep: true },
);

// 外部 columns 变化时重建
watch(
  () => props.columns,
  () => {
    if (!worksheetInstance) return;
    const expected = props.columns.length;
    const actual = worksheetInstance.options?.columns?.length ?? 0;
    if (expected !== actual) {
      const existingData = (() => {
        try {
          return worksheetInstance.getData?.() ?? [];
        } catch {
          return [];
        }
      })();
      try {
        spreadsheetInstance.destroy?.();
      } catch {}
      spreadsheetInstance = null;
      worksheetInstance = null;
      if (containerRef.value) containerRef.value.innerHTML = '';
      init();
      nextTick(() => {
        if (existingData.length > 0 && worksheetInstance) {
          worksheetInstance.setData(normalizeData(existingData));
        }
      });
    }
  },
  { deep: true, immediate: false },
);

defineExpose({
  getInstance,
  setData,
  resetData,
});
</script>

<template>
  <div ref="containerRef" class="jspreadsheet-wrapper"></div>
</template>

<style scoped>
.jspreadsheet-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 完全隐藏顶部工具栏 */
:deep(.jexcel) > div:first-child {
  display: none !important;
}

:deep(.jtab) {
  display: none !important;
}

:deep(.jexcel_footer) {
  display: none !important;
}

:deep(.jexcel_contextmenu) {
  z-index: 9999;
}

/* 禁用列拖拽 */
:deep(.jexcel th) {
  cursor: default !important;
  user-select: none !important;
}

:deep(.jexcel th),
:deep(.jexcel th > *) {
  -webkit-user-drag: none !important;
  pointer-events: auto !important;
}

:deep(.jexcel th .jexcel-column-handle),
:deep(.jexcel thead .drag-handle),
:deep(.jexcel thead [draggable]) {
  display: none !important;
  pointer-events: none !important;
}

/* 主题样式覆盖 */
:deep(.jexcel) {
  font-size: 13px;
  font-family: inherit;
  color: var(--text-color, #000);
  background: var(--component-bg, #fff);
  border: 1px solid var(--border-color, #d9d9d9) !important;
  border-radius: 6px;
}

:deep(.jexcel_container),
:deep(.jexcel_content) {
  overflow: visible !important;
}

:deep(.jexcel thead) {
  background: var(--hover-bg, #fafafa);
}

:deep(.jexcel td) {
  padding: 4px 8px;
  border-color: var(--border-color, #d9d9d9) !important;
  background: var(--component-bg, #fff) !important;
  color: var(--text-color, #000) !important;
  text-align: center;
  overflow: visible !important;
}

:deep(.jexcel th) {
  padding: 8px;
  border-color: var(--border-color, #d9d9d9) !important;
  background: var(--hover-bg, #fafafa) !important;
  color: var(--text-color, #000) !important;
  font-weight: 600;
  text-align: center;
}

:deep(.jexcel th > *),
:deep(.jexcel th) {
  text-align: center !important;
}

:deep(.jexcel td.selected) {
  background: var(--primary-1, #e6f7ff) !important;
  border-color: var(--primary-color, #1890ff) !important;
}

:deep(.jexcel tbody tr:hover td) {
  background: var(--hover-bg, #f5f5f5) !important;
}

/* 关键：jSuites dropdown 浮层（position:true 时定位到屏幕外） */
:deep(.jdropdown-container) {
  background: #fff !important;
  border: 1px solid #d9d9d9 !important;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18) !important;
  border-radius: 4px !important;
  z-index: 99999 !important;
  max-height: 260px !important;
  overflow-y: auto !important;
}

:deep(.jdropdown-item) {
  color: #333 !important;
  padding: 8px 12px !important;
  cursor: pointer !important;
  user-select: none !important;
}

:deep(.jdropdown-item:hover),
:deep(.jdropdown-item.jdropdown-selected),
:deep(.jdropdown-item.jdropdown-focus) {
  background: #e6f7ff !important;
  color: #1890ff !important;
}

/* 关键：cell 内的 .jdropdown 容器不能撑开 cell（浮层是 fixed 定位） */
:deep(.jexcel td > .jdropdown),
:deep(.jexcel td > .jdropdown-searchbar),
:deep(.jexcel td > .jdropdown-list),
:deep(.jexcel td > .jdropdown-picker) {
  display: block !important;
  width: 100% !important;
  position: relative;
}

/* 隐藏 cell 内 dropdown 的 header、backdrop 等占位元素 */
:deep(.jexcel td .jdropdown-container-header),
:deep(.jexcel td .jdropdown-backdrop) {
  display: none !important;
}

/* 主容器允许溢出 */
:deep(.jexcel_wrapper),
:deep(.jexcel > .jexcel_container),
:deep(.jexcel > .jexcel_content) {
  overflow: visible !important;
}

/* 数字列右对齐 */
:deep(.jexcel td.jexcel_column_3),
:deep(.jexcel td.numeric) {
  text-align: right !important;
}
</style>
