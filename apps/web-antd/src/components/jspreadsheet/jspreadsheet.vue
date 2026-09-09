<!-- Jspreadsheet CE 封装组件 用于订单明细等需要 Excel 风格复制粘贴的场景
特性列数锁定为 props.columns.length，禁止新增/删除列、禁止列拖拽排序
通过 dictType 字段在组件内部自动加载字典选项使用 jspreadsheet 原生
dropdown（tableOverflow:true → position:true 自动脱离容器）数量列通过
onbeforechange 校验只接受数字，空值允许 使用 jspreadsheet v5 原生的
options.onchange / options.onload 等回调 -->
<script setup lang="ts">
import type { ColumnDefinition, JspreadsheetInstance } from './typing';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import jspreadsheet from 'jspreadsheet-ce';

import { getDictOptions } from '#/utils';

import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jspreadsheet-ce/dist/jspreadsheet.themes.css';
import 'jsuites/dist/jsuites.css';

const props = withDefaults(
  defineProps<{
    columns: ColumnDefinition[];
    /** 复制时是否包含表头，默认 true */
    copyWithHeader?: boolean;
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
    copyWithHeader: true,
    onChange: undefined,
    onLoaded: undefined,
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

/** 不区分大小写匹配下拉项，并返回字典中的标准值 */
function matchDropdownValue(
  col: ColumnDefinition,
  value: unknown,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  const input = String(value).trim();
  if (!input) return undefined;
  const normalizedInput = input.toLocaleLowerCase();
  return resolveDropdownSource(col).find(
    (item) => item.trim().toLocaleLowerCase() === normalizedInput,
  );
}

/**
 * 将可匹配的下拉值统一成字典中的大小写。
 * - 命中 source：归一化成字典的标准写法
 * - 未命中：原样保留（用户已经在 onbeforechange 策略 B 下被允许输入非标值，
 *   这里不应再二次清空，否则外部回填 props.data 时会丢数据）
 */
function normalizeDropdownValue(colIndex: number, value: any): any {
  const col = props.columns[colIndex];
  if (col?.type !== 'dropdown' || value === '' || value === null) return value;
  const matched = matchDropdownValue(col, value);
  return matched ?? (typeof value === 'string' ? value.trim() : value);
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
      // 开启 jsuitse dropdown 自带的本地 like 搜索输入框；
      // 数据项多的时候（字典 / SKU 等）特别有用，录单员边输边筛。
      config.autocomplete = true;
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
  const result: any[] = Array.from({ length }, () => '');
  if (row) {
    for (let i = 0; i < length; i++) {
      result[i] = normalizeDropdownValue(i, row[i] ?? '');
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
    getData: () => getData(),
    setData: (data: any[][]) => {
      if (worksheetInstance) {
        worksheetInstance.setData(normalizeData(data));
        nextTick(() => lockColumns());
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
  const colCount = props.columns.length > 0 || props.minCols;
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

      // 拦截粘贴事件，支持粘贴包含表头的内容
      nextTick(() => {
        const tableEl = worksheetInstance?.el;
        if (tableEl) {
          const handlePaste = (e: ClipboardEvent) => {
            const clipboardData = e.clipboardData;
            if (!clipboardData) return;

            const text = clipboardData.getData('text/plain');

            if (!text) return;

            const rows = text.split('\n').filter((line) => line.trim());
            if (rows.length === 0) return;

            // 解析为二维数组
            const pastedData = rows.map((row) =>
              row.split('\t').map((cell) => cell.trim()),
            );

            // 检查第一行是否是表头（匹配任意一列的 title）
            const firstRow = pastedData[0]!;
            let matchedCol = -1;
            for (const [colIdx, cellValue] of firstRow.entries()) {
              const col = props.columns[colIdx];
              if (col && cellValue === String(col.title).trim()) {
                matchedCol = colIdx;
                break;
              }
            }

            // 如果匹配到表头，跳过第一行
            if (matchedCol >= 0 && pastedData.length > 1) {
              e.preventDefault();

              // 获取当前选中的单元格
              const selectedCell = tableEl.querySelector('.jss_selected');
              if (!selectedCell) return;

              const td = selectedCell.closest('td');
              if (!td) return;

              const startRow = Number.parseInt(td.dataset.y ?? '0', 10);
              const startCol = Number.parseInt(td.dataset.x ?? '0', 10);

              // 逐行设置数据
              const dataRows = pastedData.slice(1);
              dataRows.forEach((row, rowOffset) => {
                row.forEach((cell, colOffset) => {
                  const targetRow = startRow + rowOffset;
                  const targetCol = startCol + colOffset;
                  if (worksheetInstance) {
                    worksheetInstance.setCellValue(targetRow, targetCol, cell);
                  }
                });
              });
            }
            // 如果没有匹配到表头，让默认行为处理
          };

          tableEl.addEventListener('paste', handlePaste, true);
          (instance as any).__pasteHandler = handlePaste;
        }
      });
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
      rowIndex: number | string,
      newValue: any,
    ) => {
      const cIdx = Number(colIndex);
      const column = props.columns[cIdx];
      if (newValue === undefined || newValue === null) {
        console.warn('[Jspreadsheet] validation failed', {
          reason: 'value is null or undefined',
          rowIndex,
          colIndex,
          columnTitle: column?.title,
          columnType: column?.type,
          newValue,
        });
        return '';
      }
      if (numericCols.has(cIdx)) {
        const normalized = normalizeNumericInput(newValue);
        if (normalized === '' && String(newValue).trim() !== '') {
          console.warn('[Jspreadsheet] validation failed', {
            reason: 'numeric value cannot be normalized',
            rowIndex,
            colIndex,
            columnTitle: column?.title,
            columnType: column?.type,
            newValue,
          });
        }
        return normalized === '' && newValue === '' ? undefined : normalized;
      }
      if (column?.type === 'dropdown') {
        if (typeof newValue === 'string' && newValue.trim() === '') {
          return undefined;
        }
        // 命中 source：归一化成字典里的标准大小写
        const matchedValue = matchDropdownValue(column, newValue);
        if (matchedValue !== undefined) return matchedValue;
        // 未命中：策略 B —— 允许用户先录入"字典外的口径"，
        // 原样保留 trim 后的字符串。提交时由业务层做最终校验。
        if (typeof newValue === 'string') return newValue.trim();
        return newValue;
      }
      if (typeof newValue === 'string') {
        return newValue === '' ? undefined : newValue;
      }
      console.warn('[Jspreadsheet] validation failed', {
        reason: 'non-text value supplied to text column',
        rowIndex,
        colIndex,
        columnTitle: column?.title,
        columnType: column?.type,
        newValue,
      });
      return '';
    },
    // 单元格值变化（包括输入和粘贴）
    onchange: (
      _instance: any,
      _cell: HTMLTableCellElement,
      _colIndex: number | string,
      _rowIndex: number | string,
      newValue: any,
      oldValue: any,
    ) => {
      // 忽略幽灵 onchange（jspreadsheet 内部会在某些路径上发出 undefined 值的 onchange）
      if (newValue === undefined || newValue === null) {
        return;
      }
      // 忽略值未变化的情况
      if (newValue === oldValue) {
        return;
      }
      const data = worksheetInstance?.getData?.() ?? [];
      emitChange(data);
    },
    // 复制时是否包含表头（根据 props.copyWithHeader 配置）
    oncopy: (_instance: any, selectedRange: any, copiedData: string) => {
      // 不包含表头
      if (!props.copyWithHeader) {
        return;
      }

      // selectedRange 格式: [x1, y1, x2, y2] - 选中的矩形范围
      // 只取选中列的表头
      let startCol = 0;
      let endCol = props.columns.length - 1;

      if (Array.isArray(selectedRange) && selectedRange.length >= 4) {
        const x1 = Number(selectedRange[0]);
        const x2 = Number(selectedRange[2]);
        startCol = Math.min(x1, x2);
        endCol = Math.max(x1, x2);
      } else if (Array.isArray(selectedRange) && selectedRange.length >= 2) {
        // 部分版本可能只传选中的单元格
        const x1 = Number(selectedRange[0]);
        startCol = x1;
        endCol = x1;
      }

      const headers: string[] = [];
      for (let i = startCol; i <= endCol; i++) {
        headers.push(String(props.columns[i]?.title ?? ''));
      }

      const headerRow = headers.join('\t');
      const result = `${headerRow}\n${copiedData}`;
      return result;
    },
    // 粘贴完成后（支持粘贴表头）
    onpaste: (event: any) => {
      lockColumns();

      // 延迟执行，等待 jspreadsheet 内部处理完成
      nextTick(() => {
        const data = worksheetInstance?.getData?.() ?? [];
        emitChange(data);
      });
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
    // 注意：setData 后 emitChange 由 jspreadsheet 的 onload/onchange 触发，
    // 不在这里调用，避免时序问题
  }
}

/** 对外暴露：获取数据 */
function getData(): any[][] {
  if (worksheetInstance) {
    return worksheetInstance.getData?.() ?? [];
  }
  return [];
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
      // 移除 paste 事件监听器
      const pasteHandler = (spreadsheetInstance as any).__pasteHandler;
      if (pasteHandler && worksheetInstance?.el) {
        worksheetInstance.el.removeEventListener('paste', pasteHandler);
      }
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
/* =================================================================
 * Jspreadsheet CE v5 主题适配
 *
 * 关键：jspreadsheet 官方变量 --border_color / --header_background /
 * --content_background / --menu_background 等必须在 **全局 CSS 中**
 * 赋值到 vben 的主题 token，否则 themes.css 的 var() 全部回退到 fallback。
 * 这部分已搬到 apps/web-antd/src/adapter/jspreadsheet.css，
 * 由全局样式统一管理，自动适配 light / dark。
 *
 * 下面只保留 :
 *   1. 一些结构性样式（字号 / 居中 / 隐藏工具栏 / 数字列右对齐）
 *   2. themes.css 覆盖不到的硬编码（jspreadsheet.css 里直接写死的）
 *   3. jsuites 的 dropdown / editor（jsuites.css 没暴露 CSS 变量）
 * ================================================================= */
.jspreadsheet-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 完全隐藏顶部工具栏 / 分页 / tabs */
:deep(.jss_toolbar),
:deep(.jss_toolbar:empty),
:deep(.jss_about),
:deep(.jss_pagination),
:deep(.jss_filter),
:deep(.jss_spreadsheet > .jtabs),
:deep(.jss_spreadsheet > .jexcel_footer) {
  display: none !important;
}
:deep(.jss_spreadsheet > div:first-child) {
  display: none !important;
}

/* 容器允许溢出（dropdown 浮层要溢出） */
:deep(.jss_spreadsheet),
:deep(.jss_container),
:deep(.jss_content) {
  overflow: visible !important;
}

:deep(.jss_worksheet) {
  font-size: 13px;
  font-family: inherit;
}

/* 数字列右对齐 */
:deep(.jss_worksheet td.numeric) {
  text-align: right !important;
}

/* =================================================================
 * themes.css 没接管这些硬编码（仍在 jspreadsheet.css 里）
 * 必须靠 :deep 选择器补
 * ================================================================= */

/* .jss_worksheet 容器自身的白底
   （themes.css 只接管了内部 td 的背景，没接管 .jss_worksheet 容器） */
:deep(.jss_worksheet) {
  background-color: hsl(var(--card)) !important;
  color: hsl(var(--foreground)) !important;
  border-color: hsl(var(--border)) !important;
}

/* 内部 td 自身没有 background，由 .jss_worksheet 透传；对深色无问题
   但要确保表格内容文字色正确（themes.css 只设了 .content_color，
   fallback 是 #000，深色下不可见，但我们的 :root 全局已重新赋值，
   这里依然补一份防止 themes.css 未生效） */
:deep(.jss_worksheet > thead > tr > td),
:deep(.jss_worksheet > tbody > tr > td),
:deep(.jss_worksheet > tfoot > tr > td) {
  color: hsl(var(--foreground));
}

/* themes.css 没接管的硬编码：
   - .jss_worksheet > thead > tr > td.selected { #dcdcdc }
   - .jss_worksheet > tbody > tr.selected > td:first-child { #dcdcdc }
   - .jss_worksheet tbody .jss_freezed { #fff }
   - .jss_worksheet .editor .jupload / .jss_richtext { #fff }
   - .jss_corner { rgb(0,0,0) }
   - .jss_worksheet .onDrag { rgba(0,0,0,0.6) }
   - .fullscreen { #ffffff }
   - .jss_worksheet > tbody > tr > td.readonly { rgba(0,0,0,0.3) }
   - .jss_worksheet tbody > tr.dragging > td { #eee } */
:deep(.jss_worksheet > thead > tr > td.selected),
:deep(.jss_worksheet > tbody > tr.selected > td:first-child) {
  background-color: hsl(var(--primary) / 15%) !important;
  color: hsl(var(--primary)) !important;
}
:deep(.jss_worksheet tbody .jss_freezed) {
  background-color: hsl(var(--card)) !important;
  box-shadow: 1px 1px 1px 1px hsl(var(--border)) !important;
}
:deep(.jss_worksheet thead .jss_freezed),
:deep(.jss_worksheet tfoot .jss_freezed) {
  box-shadow: 2px 0px 2px 0.2px hsl(var(--border)) !important;
}
:deep(.jss_worksheet .editor .jupload),
:deep(.jss_worksheet .editor .jss_richtext) {
  background-color: hsl(var(--popover)) !important;
  color: hsl(var(--foreground)) !important;
  box-shadow: 0 8px 10px 1px hsl(var(--overlay)) !important;
}
:deep(.jss_worksheet > tbody > tr > td.readonly) {
  color: hsl(var(--muted-foreground)) !important;
}
:deep(.jss_worksheet > tbody > tr.dragging > td) {
  background-color: hsl(var(--muted)) !important;
}
:deep(.fullscreen) {
  background-color: hsl(var(--background)) !important;
}

/* 冻结列模式下，右下角的小黑块 .jss_corner 不重要，保持原样 */

/* scrollbar */
:deep(.jss_content::-webkit-scrollbar-track) {
  background: hsl(var(--muted)) !important;
}
:deep(.jss_content::-webkit-scrollbar-thumb) {
  background: hsl(var(--border)) !important;
}

/* checkbox / radio accent color */
:deep(.jss_worksheet input[type='checkbox']),
:deep(.jss_worksheet input[type='radio']) {
  accent-color: hsl(var(--primary));
}

/* =================================================================
 * jsuites.css - jsuitse 没暴露 CSS 变量，只能用 :deep
 * ================================================================= */
:deep(.jdropdown-container) {
  background-color: hsl(var(--popover)) !important;
  border: 1px solid hsl(var(--border)) !important;
  color: hsl(var(--foreground)) !important;
  box-shadow: 0 6px 16px hsl(var(--overlay)) !important;
  border-radius: 4px;
  z-index: 99999 !important;
  max-height: 260px !important;
  overflow-y: auto !important;
}
:deep(.jdropdown-content) {
  background-color: hsl(var(--popover)) !important;
  color: hsl(var(--foreground)) !important;
}
:deep(.jdropdown-item) {
  color: hsl(var(--foreground)) !important;
  background-color: transparent !important;
}
:deep(.jdropdown-item:hover),
:deep(.jdropdown-item.jdropdown-cursor),
:deep(.jdropdown-item.jdropdown-focus) {
  background-color: hsl(var(--accent-hover)) !important;
  color: hsl(var(--foreground)) !important;
}
:deep(.jdropdown-default .jdropdown-selected) {
  background-color: hsl(var(--primary) / 15%) !important;
  color: hsl(var(--primary)) !important;
}
:deep(.jdropdown-group) {
  background-color: hsl(var(--popover)) !important;
}
:deep(.jdropdown-group-name) {
  background-color: hsl(var(--muted)) !important;
  color: hsl(var(--foreground)) !important;
  border-bottom: 1px solid hsl(var(--border)) !important;
}

/* 编辑态 input/textarea caret + placeholder + focus */
:deep(.jss_worksheet > tbody > tr > td > input),
:deep(.jss_worksheet > tbody > tr > td > textarea),
:deep(.jss_worksheet .editor > input) {
  caret-color: hsl(var(--primary)) !important;
}
:deep(.jss_worksheet > tbody > tr > td > input::placeholder),
:deep(.jss_worksheet > tbody > tr > td > textarea::placeholder) {
  color: hsl(var(--muted-foreground)) !important;
}
:deep(.jss_worksheet > tbody > tr > td > input:focus),
:deep(.jss_worksheet > tbody > tr > td > textarea:focus),
:deep(.jss_worksheet .editor > input:focus) {
  outline-color: hsl(var(--primary)) !important;
}
</style>
