/**
 * 订单打印导出工具
 *
 * 内部渲染出与 `apps/web-antd/src/views/erp/order/modules/print-form.vue` 视觉一致的
 * 一张制单单据，导出成 PNG 并自动上传到服务器。
 *
 * 使用方式（完全异步，不阻塞主线程）：
 * ```ts
 * // 直接调用，内部自动在下一个事件循环执行，不影响当前操作
 * uploadOrderPrintImage(orderNo);
 * ```
 */
import type { Dayjs } from 'dayjs';

import type { OrderApi } from '#/api/erp/order';
import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { useUserStore } from '@vben/stores';
import { formatDate } from '@vben/utils';

import { toPng } from 'html-to-image';

import { getOrderDetailNo, updateOrderPrintImage } from '#/api/erp/order';
import { DICT_TYPE, getDictLabel } from '#/utils';

const PRINT_CONTAINER_ID = 'orderPrintDiv';

// 与 print-form.vue 中的常量保持一致
const MIN_ROWS = 20;
const TABLE_ROW_PX = 24;
const STATUS_ROWS_BEFORE_IMG = 3;

/**
 * 判断是否为"正常"状态（orderStatus === '3'）
 */
function isNormalStatus(orderStatus: any): boolean {
  return orderStatus === '1';
}

/**
 * 订单状态样式：
 * - 正常（1）→ 绿底黑字
 * - 其他 → 红底黑字
 */
function buildOrderStatusCell(value: any): {
  className: string;
  label: string;
  style: string;
} {
  const label = dictLabel(DICT_TYPE.ERP_ORDER_STATUS, value);
  const normal = isNormalStatus(value);
  const className = normal ? 'status-green' : 'status-red';
  const style = normal ? '' : 'font-weight: 700;';
  return { label, className, style };
}

const IMG_GRID_GAP = 2;
/**
 * 款式图布局里图片与图片之间的实际像素 gap。
 * 与 print-form.vue 中的 IMG_CELL_GAP_PX 等价，并跟 CSS .product-imgs 的 gap 同源。
 * 不要再用 IMG_GRID_GAP（那是"张数阈值"，不是像素）。
 */
const IMG_CELL_GAP_PX = 8;
/**
 * 款式图视觉缩放系数（仅打印场景生效）。
 * 与 print-form.vue 的 IMG_SCALE 等价；两边必须保持一致，
 * 否则同一份图在预览和导出图里占比不一样。
 * 配套 CSS：.product-img width: calc(100% * IMG_SCALE) + 水平居中。
 */
const IMG_SCALE = 0.95;

/**
 * 二维码 td 净空（与 print-form.vue 中的 QR_CELL_INNER_* 保持一致）：
 *   qr-cell：colspan=4 × 700 / 12 ≈ 233px 宽；rowspan=4 × 24 = 96px 高；
 *   扣 1px 边框双向 → 约 231×94px。
 */
const QR_CELL_INNER_WIDTH = (700 * 4) / 12 - 2;
const QR_CELL_INNER_HEIGHT = 4 * 24 - 2;

/** 按张数算每张二维码的 inline style —— 直接写到 <img> 上，
 * 这样不管是浏览器显示 / 打印 PDF / 截图都拿到一致尺寸，
 * 不依赖 aspect-ratio / max-height 100% 这种 iframe 渲染不稳定的 CSS。 */
function qrItemStyle(n: number): string {
  if (n <= 0) return '';
  if (n === 1) {
    const w = Math.floor(QR_CELL_INNER_WIDTH * 0.9);
    const h = Math.floor(QR_CELL_INNER_HEIGHT * 0.9);
    const side = Math.min(w, h);
    return `width:${side}px;height:${side}px;`;
  }
  const gap = 4;
  const perW = Math.floor((QR_CELL_INNER_WIDTH - gap * (n - 1)) / n);
  const side = Math.max(18, Math.min(perW, QR_CELL_INNER_HEIGHT - 4));
  return `width:${side}px;height:${side}px;`;
}

/**
 * 与 print-form.vue 中 `<style>` 块完全一致。
 *
 * 这里搬到 head 里再内联进渲染容器时仍然用同一份文本——避免两处样式各自漂移。
 * 拆出 <style> 包裹后方便塞到 <style> 元素里。
 */
function getPrintCss(): string {
  return `
* { box-sizing: border-box; }
/* 关键：避免 vue3-print-nb / iframe 误判为"无限页"（SO 71849004） */
html, body { margin: 0 !important; padding: 0 !important; height: auto !important; }
#${PRINT_CONTAINER_ID} {
  font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #000;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
#${PRINT_CONTAINER_ID}.jls-print {
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  padding: 12px;
  box-sizing: border-box;
}
#${PRINT_CONTAINER_ID},
#${PRINT_CONTAINER_ID} * {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
#${PRINT_CONTAINER_ID} table.jls-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  outline: 1px solid #2f6fb5;
  table-layout: fixed;
  page-break-inside: auto;
}
#${PRINT_CONTAINER_ID} td,
#${PRINT_CONTAINER_ID} th {
  border: 1px solid #2f6fb5;
  padding: 1.5pt 4pt;
  min-height: 18pt;
  vertical-align: middle;
  word-break: break-all;
  text-align: center;
}
#${PRINT_CONTAINER_ID} .title-cell {
  font-size: 18px;
  padding: 4px 0 10px;
}
#${PRINT_CONTAINER_ID} .lbl {
  background: #c9d9ef;
  font-weight: 600;
  white-space: nowrap;
}
#${PRINT_CONTAINER_ID} .lbl-orange { background: #f6c9a3; }
#${PRINT_CONTAINER_ID} .lbl-yellow { background: #ffff66; }
#${PRINT_CONTAINER_ID} .lbl-tall { height: 40px; }
#${PRINT_CONTAINER_ID} .val-red { color: #d40000; font-weight: 600; }
#${PRINT_CONTAINER_ID} .val-fabric { background: #ffff00; font-weight: 700; }
#${PRINT_CONTAINER_ID} .val-area {
  text-align: left;
  vertical-align: middle;
}
#${PRINT_CONTAINER_ID} .val-total { font-weight: 700; background: #f2f2f2; }
#${PRINT_CONTAINER_ID} .status-cell { font-weight: 700; }
/* 字体颜色由内联 style 控制（取字典 colorType 映射），这里只兜底 */
#${PRINT_CONTAINER_ID} .status-normal { background: transparent; }
/* 绿底黑字（正常状态 orderStatus === '3'） */
#${PRINT_CONTAINER_ID} .status-green { background: #52c41a; color: #000; font-weight: 700; }
/* 红底黑字（非正常状态） */
#${PRINT_CONTAINER_ID} .status-red { background: #ff4d4f; color: #000; font-weight: 700; }
#${PRINT_CONTAINER_ID} .status-mid { background: #ffff00; color: #000; }
#${PRINT_CONTAINER_ID} .status-neck { color: #d40000; background: #eef3fb; }
#${PRINT_CONTAINER_ID} .qr-cell { vertical-align: middle; padding: 0; height: 96px; }
#${PRINT_CONTAINER_ID} .qr-imgs {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
#${PRINT_CONTAINER_ID} .qr-img {
  display: block;
  margin: 0 auto;
  object-fit: contain;
  background: #fff;
  flex-shrink: 0;
}
/* 尺码统计：红色加粗 */
#${PRINT_CONTAINER_ID} .jls-stat-text {
  color: #d40000;
  font-weight: 700;
}
/* 车间要求 / 包装要求：红色加粗加大 */
#${PRINT_CONTAINER_ID} .jls-emph-red {
  color: #d40000;
  font-weight: 700;
}
#${PRINT_CONTAINER_ID} .img-panel {
  vertical-align: top;
  padding: 8px;
  page-break-inside: avoid;
}
/*
 * 款式图容器布局：
 *   - is-single（≤IMG_GRID_GAP 张）：单列纵向排列
 *   - is-multi（>IMG_GRID_GAP 张）：两列网格，每行高度 = 图片内容高度（min-content）
 */
#${PRINT_CONTAINER_ID} .product-imgs.is-single {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: auto;
  align-items: stretch;
}
#${PRINT_CONTAINER_ID} .product-imgs.is-multi {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: min-content;
  align-items: stretch;
  justify-items: stretch;
  gap: 8px;
  width: 100%;
  height: auto;
}
#${PRINT_CONTAINER_ID} .product-img {
  display: block;
  /* 宽度按 IMG_SCALE 缩 5%，水平居中——打印版面图片整体小一圈。
   * 同步预览端 print-form.vue 的规则，保证两边一致。 */
  width: calc(100% * 0.95);
  max-width: 100%;
  margin: 0 auto;
  height: auto;
  object-fit: contain;
  background: #fff;
  min-height: 0;
}
/* 单列模式下每张图同样按 IMG_SCALE 占整列宽度，水平居中 */
#${PRINT_CONTAINER_ID} .product-imgs.is-single .product-img {
  width: calc(100% * 0.95);
  max-width: 100%;
  margin: 0 auto;
}
#${PRINT_CONTAINER_ID} .jls-meta {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
}
@media print {
  #${PRINT_CONTAINER_ID} {
    max-width: none;
    padding: 12mm;
  }
  #${PRINT_CONTAINER_ID} table.jls-table {
    border-collapse: collapse !important;
    border: none !important;
    outline: none !important;
  }
  #${PRINT_CONTAINER_ID} table.jls-table td,
  #${PRINT_CONTAINER_ID} table.jls-table th {
    border: 1px solid #2f6fb5 !important;
  }
  body, html { margin: 0 !important; padding: 0 !important; }
}
`;
}

function formatDateValue(value: Dayjs | number | string | undefined) {
  if (value === undefined || value === null || value === '') return '';
  return formatDate(value as Date | number | string);
}

function dictLabel(type: string, value: number | string | undefined) {
  if (value === undefined || value === null || value === '') return '';
  return getDictLabel(type, value);
}

function getOrderImages(raw: unknown): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(/\|\||[,;\n]/);
  return arr.map((s: unknown) => String(s ?? '').trim()).filter(Boolean);
}

/**
 * 量 DOM 里 td.img-panel 的实际渲染净宽，再用 naturalWidth/Height 模拟 grid 布局
 * 算出图片区总像素高。量 DOM 宽度 → 预览和导出用同一个计算基准 → rowCount 完全一致。
 *
 * 关键坑（与 print-form.vue 同款，注释见那边）：
 *   1. naturalWidth/naturalHeight 拿不到 → 跳过，不让 aspect 兜底成 1 把横向图 cellH 翻倍。
 *   2. 图片间隙用 IMG_CELL_GAP_PX（=8px），与 CSS 同源。
 *   3. **cellWidth 必须从 DOM 实际渲染的 img 上取**。
 *      预览端（#orderPrintDiv 在抽屉内 ~570px 宽）和导出端（临时容器固定 700px）
 *      外层宽不一样；纯靠 (contentWidth - gap) / cols 算，两边会差 30~50px，
 *      同一份图在两端算出不同 rowspan，导出版"多几行"。
 *      直接读 domImgs[i].clientWidth 作为 cellWidth，aspect 用 naturalWidth/Height
 *      推 cellH，函数与浏览器渲染 100% 同源，**预览/导出版行数完全一致**。
 */
function calcImageGridHeight(sourceEl: HTMLElement, imgs: string[]): number {
  const td = sourceEl.querySelector<HTMLElement>('td.img-panel');
  if (!td) return 0;

  const domImgs: HTMLImageElement[] = [
    ...sourceEl.querySelectorAll<HTMLImageElement>('img.product-img'),
  ];

  const cols = imgs.length <= IMG_GRID_GAP ? 1 : 2;

  const ready: { cellH: number; cellW: number }[] = [];
  for (let i = 0; i < imgs.length; i++) {
    const dom = domImgs[i];
    const w = dom?.naturalWidth ?? 0;
    const h = dom?.naturalHeight ?? 0;
    if (w <= 0 || h <= 0) continue;
    const cellW = dom?.clientWidth ?? 0;
    if (cellW <= 0) continue;
    const aspect = w / h;
    ready.push({ cellW, cellH: cellW / aspect });
  }

  if (ready.length === 0) return 0;

  let totalPx = 0;
  let rowMaxPx = 0;
  for (const [i, element] of ready.entries()) {
    if (i % cols === 0) {
      if (i > 0) {
        totalPx += rowMaxPx + IMG_CELL_GAP_PX;
        rowMaxPx = 0;
      }
      rowMaxPx = element!.cellH;
    } else {
      rowMaxPx = Math.max(rowMaxPx, element!.cellH);
    }
  }
  totalPx += rowMaxPx;
  return totalPx;
}

/**
 * 与 print-form.vue 中模板渲染顺序一致的 HTML 字符串构造。
 * 唯一变化：模板里写死的"打印人"现在从 useUserStore 里取；其他细节保持一致，
 * 包括：12 等分 colgroup、明细行 colspan、"款式图 rowspan"= rowCount - 3、二维码 rowspan = 4。
 */
function buildHtmlBody(
  orderTitle: string,
  orderDetail: OrderApi.Order,
  orderProcess?: OrderProcessApi.OrderProcess,
  orderDetails?: OrderApi.OrderDetail[],
  imgHeightPx = 0,
  qrCodeUrls: string[] = [],
  printerName = '',
  printTime = '',
  orderStatus?: number | string,
): string {
  const orderImages = getOrderImages((orderDetail as any)?.orderImage);
  const isNormal = isNormalStatus(orderStatus);

  // 标题样式：正常状态无背景色，非正常状态红底黑字
  const titleStyle = isNormal ? '' : 'background:#ff4d4f;color:#000;';
  const titleClass = isNormal ? '' : 'status-red';

  const validDetails = (orderDetails ?? []).filter(
    (row) => row.setSize && Number(row.setQuantity) > 0,
  );

  /**
   * 尺码 => 数量 汇总（导出场景，与预览端 print-form.vue 的 sizeSummary 口径完全一致）
   *
   * 排序口径：**按订单详情 orderDetails 中 setSize 首次出现的下标升序**——
   * 这样"尺码统计行"与详情里尺码出现的顺序一一对应，看起来不"乱"。
   *
   * 关键坑：
   *   1. 同一尺码多次出现要累加（不变）。
   *   2. **字典没声明的尺码不能丢**。原实现用 `sizeSortList.filter(has)`，
   *      会把字典之外的尺码直接过滤掉。改用 `dictLabel` 兜底——
   *      字典有就用字典 label，没有就用原值，避免自定义尺码消失在统计里。
   *   3. firstIdx 用累加时第一次写入的下标（不是 min），保证"详情顺序"语义清晰。
   */
  const sizeSummary = (() => {
    const acc = new Map<
      string,
      { firstIdx: number; label: string; qty: number }
    >();
    validDetails.forEach((row, idx) => {
      const size = row.setSize;
      const qty = Number(row.setQuantity) || 0;
      if (size === undefined || size === null || size === '' || qty <= 0)
        return;
      const key = String(size);
      const existed = acc.get(key);
      if (existed) {
        existed.qty += qty;
      } else {
        acc.set(key, {
          label: dictLabel(DICT_TYPE.ERP_SET_SIZE, size) || String(size),
          qty,
          firstIdx: idx,
        });
      }
    });
    return [...acc.values()]
      .sort((a, b) => a.firstIdx - b.firstIdx)
      .map(({ label, qty }) => ({ label, qty }));
  })();
  const sizeTotal = sizeSummary.reduce((sum, i) => sum + i.qty, 0);
  const sizeRows = [
    ...sizeSummary.map((i) => ({ ...i, isTotal: false })),
    { label: '总计', qty: sizeTotal, isTotal: true },
  ];

  /**
   * 明细人员列表（名字/号码/尺码/备注）。
   * 用 validDetails 保证 personList 与下面 detailRowsHtml 的 i 索引口径一致。
   */
  const personList = validDetails.map((row) => ({
    name: (row as any).setName ?? '',
    number: row.setNumber ?? '',
    size: dictLabel(DICT_TYPE.ERP_SET_SIZE, row.setSize),
    remark: (row as any).remark ?? '',
  }));

  const requiredImageRows = Math.ceil(imgHeightPx / TABLE_ROW_PX);
  const base = Math.max(personList.length, MIN_ROWS);
  const needForImages = requiredImageRows + STATUS_ROWS_BEFORE_IMG;
  const rowCount = Math.max(base, needForImages);
  const rowIndexes = Array.from({ length: rowCount }, (_, i) => i);

  const imgsHtml = orderImages
    .map((src, idx) => {
      const isOnly = orderImages.length <= IMG_GRID_GAP;
      return `<img src="${src}" class="product-img${isOnly ? ' is-only' : ''}" alt="款式图 ${idx + 1}" />`;
    })
    .join('');

  const statusLabels = [
    dictLabel(DICT_TYPE.ERP_ORDER_STATUS, orderDetail.orderStatus),
    dictLabel(DICT_TYPE.ERP_ORDER_PICKUP_METHOD, orderDetail.pickupMethod),
    dictLabel(DICT_TYPE.ERP_NECKLINE, orderProcess?.neckline),
  ];
  const statusClasses = ['status-normal', 'status-mid', 'status-neck'];
  const orderStatusCell = buildOrderStatusCell(orderDetail.orderStatus);

  // 与 print-form.vue 模板里左侧 6 列（明细新增"数量"列）保持一致
  const detailRowsHtml = rowIndexes
    .map((i) => {
      const leftCells = `
        <td class="cell val" colspan="1">${i + 1}</td>
        <td class="cell val" colspan="1">${personList[i]?.name ?? ''}</td>
        <td class="cell val" colspan="1">${personList[i]?.number ?? ''}</td>
        <td class="cell val" colspan="1">${personList[i]?.size ?? ''}</td>
        <td class="cell val" colspan="1">${validDetails[i]?.setQuantity ?? ''}</td>
        <td class="cell val" colspan="1">${personList[i]?.remark ?? ''}</td>`;

      if (i < STATUS_ROWS_BEFORE_IMG) {
        // 第 0 行（订单状态）走字典 colorType；其他两行保持原硬编码样式
        const isOrderStatus = i === 0;
        const cls = isOrderStatus
          ? orderStatusCell.className
          : statusClasses[i];
        const styleAttr =
          isOrderStatus && orderStatusCell.style
            ? ` style="${orderStatusCell.style}"`
            : '';
        const statusHtml = `
          <td class="cell val status-cell ${cls}" colspan="2"${styleAttr}>${statusLabels[i] ?? ''}</td>`;
        return `<tr>${leftCells}${statusHtml}</tr>`;
      }
      if (i === STATUS_ROWS_BEFORE_IMG) {
        return `<tr>${leftCells}
          <td class="cell img-panel" colspan="6" rowspan="${rowCount - STATUS_ROWS_BEFORE_IMG}">
            <div class="product-imgs${orderImages.length <= IMG_GRID_GAP ? ' is-single' : ' is-multi'}">${imgsHtml}</div>
          </td>
        </tr>`;
      }
      // i > STATUS_ROWS_BEFORE_IMG：右侧 6 列已被款式图 rowspan 覆盖
      return `<tr>${leftCells}</tr>`;
    })
    .join('');

  const cols = Array.from(
    { length: 12 },
    () => '<col style="width:8.333%">',
  ).join('');

  // 顶部信息区第二行靠左（不是红色）
  return `<div id="${PRINT_CONTAINER_ID}" class="jls-print">
  <table class="jls-table">
    <colgroup>${cols}</colgroup>
    <tbody>
      <tr><th class="cell title-cell ${titleClass}" colspan="12" style="${titleStyle}">${orderTitle}</th></tr>

      <tr>
        <th class="cell lbl" colspan="2">版型</th>
        <th class="cell lbl" colspan="2">客户-队名</th>
        <th class="cell lbl" colspan="1">数量</th>
        <th class="cell lbl" colspan="2">下单日期</th>
        <th class="cell lbl" colspan="2">发货日期</th>
        <th class="cell lbl lbl-orange" colspan="1" rowspan="2">布料</th>
        <td class="cell val-fabric" colspan="2" rowspan="2">${dictLabel(DICT_TYPE.ERP_FABRIC, orderDetail.fabric)}</td>
      </tr>
      <tr>
        <td class="cell val val-red" colspan="2">${dictLabel(DICT_TYPE.ERP_PATTERN, orderDetail.pattern)}</td>
        <td class="cell val" colspan="2">${orderDetail.name ?? ''}</td>
        <td class="cell val val-red" colspan="1">${orderDetail.number ?? ''}</td>
        <td class="cell val val-red" colspan="2">${formatDateValue(orderDetail.orderTime)}</td>
        <td class="cell val val-red" colspan="2">${formatDateValue(orderDetail.exceptShippingTime)}</td>
      </tr>

      <tr>
        <th class="cell lbl" colspan="1">品类</th>
        <td class="cell val val-red" colspan="2">${dictLabel(DICT_TYPE.ERP_CATEGORY, orderProcess?.category)}</td>
        <td class="cell val val-red" colspan="2">${dictLabel(DICT_TYPE.ERP_SPECIFICATION, orderProcess?.specification)}</td>
        <th class="cell lbl" colspan="1">开衩与否</th>
        <td class="cell val val-red" colspan="1">${dictLabel(DICT_TYPE.ERP_HAS_FORKED, orderProcess?.hasForked)}</td>
        <th class="cell lbl" colspan="1">衫脚</th>
        <td class="cell val val-red" colspan="1">${dictLabel(DICT_TYPE.ERP_SHIRT_HEM, orderProcess?.shirtHem)}</td>
        <th class="cell lbl" colspan="1">口袋</th>
        <td class="cell val val-red" colspan="2">${dictLabel(DICT_TYPE.ERP_POCKET, orderProcess?.pocket)}</td>
      </tr>

      <tr>
        <th class="cell lbl lbl-tall" colspan="1">特别备注</th>
        <td class="cell val val-area" colspan="11">${orderDetail.remark ?? ''}</td>
      </tr>
      <tr>
        <th class="cell lbl lbl-tall" colspan="1">车间要求</th>
        <td class="cell val val-area jls-emph-red" colspan="11">${orderProcess?.workshopRequirements ?? ''}</td>
      </tr>

      <tr>
        <th class="cell lbl" colspan="1">尺码统计</th>
        <td class="cell val val-area jls-stat-text" colspan="11">${
          sizeRows.length > 0
            ? sizeRows.map((s) => `${s.label}-${s.qty}`).join('、')
            : ''
        }</td>
      </tr>

      <tr>
        <th class="cell lbl" colspan="1">序号</th>
        <th class="cell lbl" colspan="1">名字</th>
        <th class="cell lbl" colspan="1">号码</th>
        <th class="cell lbl" colspan="1">尺码</th>
        <th class="cell lbl" colspan="1">数量</th>
        <th class="cell lbl" colspan="1">备注</th>
        <th class="cell lbl" colspan="2">订单状态</th>
        <td class="cell qr-cell" colspan="4" rowspan="4">${
          qrCodeUrls.length > 0
            ? `<div class="qr-imgs ${qrCodeUrls.length === 1 ? 'is-single' : 'is-multi'}">${qrCodeUrls
                .map(
                  (src, idx) =>
                    `<img src="${src}" style="${qrItemStyle(qrCodeUrls.length)}" class="qr-img" alt="订单二维码 ${idx + 1}" />`,
                )
                .join('')}</div>`
            : ''
        }</td>
      </tr>
      ${detailRowsHtml}

      <tr>
        <th class="cell lbl lbl-yellow lbl-tall" colspan="1">包装要求</th>
        <td class="cell val val-area jls-emph-red" colspan="11">${orderProcess?.packagingRequirements ?? ''}</td>
      </tr>
      <tr>
        <th class="cell lbl lbl-yellow lbl-tall" colspan="1">地址</th>
        <td class="cell val val-area" colspan="11">${orderDetail.shippingAddress ?? ''}</td>
      </tr>
      <tr>
        <th class="cell lbl lbl-yellow lbl-tall" colspan="1">补水</th>
        <td class="cell val val-area" colspan="11">${orderDetail.hydration ?? ''}</td>
      </tr>
    </tbody>
  </table>
  <div class="jls-meta">
    <span>打印人：${printerName}</span>
    <span>打印时间：${printTime}</span>
  </div>
</div>`;
}

/**
 * 等容器里的 <img> 全部加载完，避免 toPng 截图时还没出现图。
 * 出错（error）也算完成，避免外部图片 CORS 失败时永远 hang。
 */
async function waitForImages(element: HTMLElement) {
  const images = [...element.querySelectorAll<HTMLImageElement>('img')];
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
}

/**
 * 根据 orderNo 导出订单打印 PNG（与 print-form.vue 走同一条 html-to-image 路线）。
 *
 * 内部完成：拉取订单详情 → 隐藏容器渲染 → 图片宽高测量 → 重渲染 → 导出 PNG → 清理容器，
 * 调用方拿到的是最终的 PNG File，无需手动管理任何状态。
 */
export async function exportOrderPrintImage(orderNo: string): Promise<File> {
  const order = await getOrderDetailNo(orderNo);
  if (!order) {
    throw new Error(`订单 ${orderNo} 不存在`);
  }
  const orderImages = getOrderImages((order as any)?.orderImage);
  const qrCodeUrls = getOrderImages((order as any)?.qrCode);

  const title = `JLS制单-${order.customer ? `${order.customer}-` : ''}${order.name ? `${order.name}-` : ''}${order.orderNo}-${dictLabel(
    DICT_TYPE.ERP_ORDER_PICKUP_METHOD,
    order.pickupMethod,
  )}`;

  // 与 print-form.vue 中 printerName 一致
  const userStore = useUserStore();
  const printerName =
    userStore.userInfo?.nickname || userStore.userInfo?.username || '';
  const printTime = String(formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss'));

  // 临时容器：放在屏幕外（left: -99999px）让用户看不到，但仍在 DOM 树里 →
  // 所有外部 stylesheet 仍命中它、computedStyle 仍正确。
  // 给容器一个明确 width，让内部 #orderPrintDiv { width: 100% } 有 layout 基准。
  const container = document.createElement('div');
  container.style.cssText =
    'position:absolute;left:-99999px;top:0;width:700px;z-index:-1;pointer-events:none;';
  // CSS 必须用 <style> 节点（innerHTML 里写 <style> 文本不会被解析）
  const styleEl = document.createElement('style');
  styleEl.textContent = getPrintCss();
  container.append(styleEl);
  document.body.append(container);

  try {
    const renderEl = document.createElement('div');
    container.append(renderEl);

    let imgHeightPx = 0;
    // 与 print-form.vue 完全一致：先渲染 0 高度图，测 naturalWidth/naturalHeight，
    // 得到图片区真实占多少像素行，再第二轮渲染完整版面。
    if (orderImages.length > 0) {
      renderEl.innerHTML = buildHtmlBody(
        title,
        order,
        order.orderProcess,
        order.orderDetails,
        0,
        qrCodeUrls,
        printerName,
        printTime,
        order.orderStatus,
      );
      await waitForImages(renderEl);
      imgHeightPx = calcImageGridHeight(renderEl, orderImages);
      renderEl.innerHTML = '';
    }

    renderEl.innerHTML = buildHtmlBody(
      title,
      order,
      order.orderProcess,
      order.orderDetails,
      imgHeightPx,
      qrCodeUrls,
      printerName,
      printTime,
      order.orderStatus,
    );

    const element = renderEl.querySelector<HTMLElement>(
      `#${PRINT_CONTAINER_ID}`,
    );
    if (!element) {
      throw new Error('打印区域渲染失败');
    }

    await waitForImages(element);
    await document.fonts?.ready;

    // 与 print-form.vue 里的 exportAsImage 完全一致：
    //   html-to-image 自己 clone → SVG foreignObject → 浏览器原生渲染，
    //   grid/flex/rowspan/position 全支持，且避免 html2canvas 那种"rowspan 把后续
    //   行遮掉"的旧 bug。width/height 让它从 scrollHeight/scrollWidth 量真实尺寸。
    //   这里保持 pixelRatio:2 出图清晰，不要压图——上传的图片要让客户看得清。
    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 3,
      cacheBust: false,
      style: {
        transform: 'none',
        transformOrigin: 'top left',
      },
    });

    const safeTitle = title.replaceAll(/[<>:"/\\|?*]/g, '-');
    const fileName = safeTitle ? `${safeTitle}.png` : `order-${orderNo}.png`;

    // 转 Blob 走 fetch，避开跨域图污染 Canvas 抛 SecurityError；
    // 失败时直接用 dataURL 兜底。
    let href: string;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      href = URL.createObjectURL(blob);
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      href = dataUrl;
    }

    // 真正拿 File：toBlob 触发 canvas 渲染在主流程里走一遍；
    // 这里直接 fetch 上面 dataURL 的 blob，再构造成 File（与打印端一致）。
    const finalBlob = await (await fetch(href)).blob();
    return new File([finalBlob], fileName, { type: 'image/png' });
  } finally {
    container.remove();
  }
}

/**
 * 生成打印图片 File 对象（内部使用）
 */
async function generatePrintImageFile(orderNo: string): Promise<File> {
  return exportOrderPrintImage(orderNo);
}

/**
 * 异步导出并上传订单打印图片，完全不阻塞主线程。
 *
 * 内部流程：导出 PNG → 上传到服务器，失败仅打日志。
 * 通过 setTimeout(0) 推迟到下一个事件循环执行，确保调用时立即返回。
 *
 * @param orderNo 订单号
 */
export function uploadOrderPrintImage(orderNo: string): void {
  setTimeout(async () => {
    try {
      const file = await generatePrintImageFile(orderNo);
      await updateOrderPrintImage({ file, orderNo });
    } catch (error) {
      console.error('打印图片上传失败', error);
    }
  }, 0);
}
