/**
 * 全局 jspreadsheet 主题变量映射：
 * jspreadsheet 自带 themes.css 通过 var(--border_color, #ccc) 读取 CSS 变量，
 * 必须放在全局（非 <style scoped>），否则会被 Vue 编译成 :root[data-v-xxx] 无法命中 <html>。
 */
import './jspreadsheet.css';

export { default as Jspreadsheet } from './jspreadsheet.vue';
export type {
  ColumnDefinition,
  JspreadsheetEmits,
  JspreadsheetInstance,
  JspreadsheetProps,
} from './typing';
