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
import { DICT_TYPE, getDictLabel, getDictOptions } from '#/utils';

const PRINT_CONTAINER_ID = 'orderPrintDiv';

// 与 print-form.vue 中的常量保持一致
const MIN_ROWS = 20;
const TABLE_ROW_PX = 24;
const STATUS_ROWS_BEFORE_IMG = 3;
const PRINT_INNER_WIDTH = 700 - 24; // 700 - 2 * 12 padding
const IMG_PANEL_COLSPAN = 5;
const IMG_PANEL_TOTAL_COLS = 12;
const IMG_PANEL_INNER_PAD = 16; // 8 + 8
const IMG_GRID_GAP = 8;

/**
 * 与 print-form.vue 中 `<style>` 块完全一致。
 *
 * 这里搬到 head 里再内联进渲染容器时仍然用同一份文本——避免两处样式各自漂移。
 * 拆出 <style> 包裹后方便塞到 <style> 元素里。
 */
function getPrintCss(): string {
  return `
* { box-sizing: border-box; }
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
#${PRINT_CONTAINER_ID} .status-normal { background: #37a24a; color: #fff; }
#${PRINT_CONTAINER_ID} .status-mid { background: #ffff00; color: #000; }
#${PRINT_CONTAINER_ID} .status-neck { color: #d40000; background: #eef3fb; }
#${PRINT_CONTAINER_ID} .qr-cell { vertical-align: middle; padding: 3px; }
#${PRINT_CONTAINER_ID} .qr-img {
  display: block;
  margin: 0 auto;
  width: 100px;
  height: 100px;
  object-fit: contain;
}
#${PRINT_CONTAINER_ID} .img-panel {
  vertical-align: top;
  padding: 8px;
  page-break-inside: avoid;
}
#${PRINT_CONTAINER_ID} .product-imgs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  align-items: stretch;
  justify-items: stretch;
  gap: 8px;
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}
#${PRINT_CONTAINER_ID} .product-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
  min-height: 0;
}
#${PRINT_CONTAINER_ID} .product-imgs .product-img.is-only {
  grid-column: 1 / -1;
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
 * 读 DOM 里 <img> 的真实宽高比，再按 2 列网格算出图片区总像素高。
 * 与 print-form.vue 中的 calcImageGridHeight 一致。
 */
function calcImageGridHeight(
  sourceEl: HTMLElement,
  imgs: string[],
  usableWidth: number,
): number {
  const domImgs: HTMLImageElement[] = [
    ...sourceEl.querySelectorAll<HTMLImageElement>('img.product-img'),
  ];

  const isSingle = imgs.length === 1;
  const cellWidth = isSingle
    ? usableWidth
    : Math.max(1, (usableWidth - IMG_GRID_GAP) / 2);

  let totalPx = 0;
  let rowMaxPx = 0;
  for (let i = 0; i < imgs.length; i++) {
    const col = i % 2;
    const dom = domImgs[i];
    const w = dom?.naturalWidth ?? 0;
    const h = dom?.naturalHeight ?? 0;
    const aspect = w > 0 && h > 0 ? w / h : 1;
    const cellH = cellWidth / aspect;

    if (col === 0) {
      if (i > 0) {
        totalPx += rowMaxPx + IMG_GRID_GAP;
        rowMaxPx = 0;
      }
      rowMaxPx = cellH;
    } else {
      rowMaxPx = Math.max(rowMaxPx, cellH);
    }
  }
  if (imgs.length > 0) totalPx += rowMaxPx;
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
  qrCodeUrl = '',
  printerName = '',
  printTime = '',
): string {
  const orderImages = getOrderImages((orderDetail as any)?.orderImage);

  const validDetails = (orderDetails ?? []).filter(
    (row) => row.setSize && Number(row.setQuantity) > 0,
  );

  const sizeOptions = getDictOptions(DICT_TYPE.ERP_SET_SIZE, 'string');
  const sizeSortList = sizeOptions
    .map((opt) => ({ value: String(opt.value), label: opt.label }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, 'zh-Hans-CN', { numeric: true }),
    );

  const personList = validDetails.map((row) => ({
    name: (row as any).name ?? '',
    number: row.setNumber ?? '',
    size: dictLabel(DICT_TYPE.ERP_SET_SIZE, row.setSize),
    remark: (row as any).remark ?? '',
  }));

  const totals = new Map<string, number>();
  for (const row of validDetails) {
    const size = row.setSize;
    const qty = Number(row.setQuantity) || 0;
    if (size === undefined || size === null || size === '' || qty <= 0)
      continue;
    totals.set(String(size), (totals.get(String(size)) ?? 0) + qty);
  }
  const sizeSummary = sizeSortList
    .filter((s) => totals.has(s.value))
    .map((s) => ({ label: s.label, qty: totals.get(s.value)! }));
  const sizeTotal = sizeSummary.reduce((sum, i) => sum + i.qty, 0);
  const sizeRows = [
    ...sizeSummary.map((i) => ({ ...i, isTotal: false })),
    { label: '总计', qty: sizeTotal, isTotal: true },
  ];

  const requiredImageRows = Math.ceil(imgHeightPx / TABLE_ROW_PX);
  const base = Math.max(personList.length, sizeRows.length, MIN_ROWS);
  const needForImages = requiredImageRows + STATUS_ROWS_BEFORE_IMG;
  const rowCount = Math.max(base, needForImages);
  const rowIndexes = Array.from({ length: rowCount }, (_, i) => i);

  const imgsHtml = orderImages
    .map((src, idx) => {
      const isOnly = orderImages.length === 1;
      return `<img src="${src}" class="product-img${isOnly ? ' is-only' : ''}" alt="款式图 ${idx + 1}" />`;
    })
    .join('');

  const imgPanelHeight = `${(rowCount - STATUS_ROWS_BEFORE_IMG) * TABLE_ROW_PX}px`;

  const statusLabels = [
    dictLabel(DICT_TYPE.ERP_ORDER_STATUS, orderDetail.orderStatus),
    dictLabel(DICT_TYPE.ERP_ORDER_PICKUP_METHOD, orderDetail.pickupMethod),
    dictLabel(DICT_TYPE.ERP_NECKLINE, orderProcess?.neckline),
  ];
  const statusClasses = ['status-normal', 'status-mid', 'status-neck'];

  // 与 print-form.vue 模板里左侧 5 列 + 尺码汇总 2 列完全一致
  const detailRowsHtml = rowIndexes
    .map((i) => {
      const leftCells = `
        <td class="cell val" colspan="1">${i + 1}</td>
        <td class="cell val" colspan="1">${personList[i]?.name ?? ''}</td>
        <td class="cell val" colspan="1">${personList[i]?.number ?? ''}</td>
        <td class="cell val" colspan="1">${personList[i]?.size ?? ''}</td>
        <td class="cell val" colspan="1">${personList[i]?.remark ?? ''}</td>`;
      const sizeCls = sizeRows[i]?.isTotal ? ' val-total' : '';
      const sizeCell = `
        <td class="cell val${sizeCls}" colspan="1">${sizeRows[i]?.label ?? ''}</td>
        <td class="cell val${sizeCls}" colspan="1">${sizeRows[i] ? sizeRows[i].qty : ''}</td>`;

      if (i < STATUS_ROWS_BEFORE_IMG) {
        const statusHtml = `
          <td class="cell val status-cell ${statusClasses[i]}" colspan="2">${statusLabels[i] ?? ''}</td>`;
        return `<tr>${leftCells}${sizeCell}${statusHtml}</tr>`;
      }
      if (i === STATUS_ROWS_BEFORE_IMG) {
        return `<tr>${leftCells}${sizeCell}
          <td class="cell img-panel" colspan="5" rowspan="${rowCount - STATUS_ROWS_BEFORE_IMG}" style="height:${imgPanelHeight}">
            <div class="product-imgs${orderImages.length === 1 ? ' is-single' : ''}">${imgsHtml}</div>
          </td>
        </tr>`;
      }
      // i > STATUS_ROWS_BEFORE_IMG：右侧 5 列已被款式图 rowspan 覆盖
      return `<tr>${leftCells}${sizeCell}</tr>`;
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
      <tr><th class="cell title-cell" colspan="12">${orderTitle}</th></tr>

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
        <td class="cell val" colspan="2">${orderDetail.customer ?? ''}</td>
        <td class="cell val val-red" colspan="1">${orderDetail.number ?? ''}</td>
        <td class="cell val val-red" colspan="2">${formatDateValue(orderDetail.orderTime)}</td>
        <td class="cell val val-red" colspan="2">${formatDateValue(orderDetail.shippingTime)}</td>
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
        <td class="cell val val-area" colspan="11">${orderProcess?.workshopRequirements ?? ''}</td>
      </tr>

      <tr>
        <th class="cell lbl" colspan="1">序号</th>
        <th class="cell lbl" colspan="1">名字</th>
        <th class="cell lbl" colspan="1">号码</th>
        <th class="cell lbl" colspan="1">尺码</th>
        <th class="cell lbl" colspan="1">备注</th>
        <th class="cell lbl" colspan="1">尺码</th>
        <th class="cell lbl" colspan="1">数量</th>
        <th class="cell lbl" colspan="2">订单状态</th>
        <td class="cell qr-cell" colspan="3" rowspan="4">${qrCodeUrl ? `<img src="${qrCodeUrl}" class="qr-img" alt="订单二维码" />` : ''}</td>
      </tr>
      ${detailRowsHtml}

      <tr>
        <th class="cell lbl lbl-yellow lbl-tall" colspan="1">包装要求</th>
        <td class="cell val val-area" colspan="11">${orderProcess?.packagingRequirements ?? ''}</td>
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
  const qrCodeUrl = String((order as any)?.qrCode ?? '').trim();

  const title = `JLS制单-${order.orderNo}-${dictLabel(
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
        qrCodeUrl,
        printerName,
        printTime,
      );
      await waitForImages(renderEl);
      const usableWidth =
        (PRINT_INNER_WIDTH * IMG_PANEL_COLSPAN) / IMG_PANEL_TOTAL_COLS -
        IMG_PANEL_INNER_PAD;
      imgHeightPx = calcImageGridHeight(renderEl, orderImages, usableWidth);
      renderEl.innerHTML = '';
    }

    renderEl.innerHTML = buildHtmlBody(
      title,
      order,
      order.orderProcess,
      order.orderDetails,
      imgHeightPx,
      qrCodeUrl,
      printerName,
      printTime,
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
    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
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
