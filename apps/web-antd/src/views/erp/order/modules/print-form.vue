<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { OrderApi } from '#/api/erp/order';
import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { computed, nextTick, ref, watch } from 'vue';

import { useVbenModelDrawer } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';
import { formatDate } from '@vben/utils';

import { Button, Empty, message, Spin } from 'ant-design-vue';
import { toPng } from 'html-to-image';

import { getOrderDetailNo, printOrder } from '#/api/erp/order';
import { $t } from '#/locales';
import { DICT_TYPE, ErpOrderPrintStatus, getDictLabel } from '#/utils';

const emit = defineEmits(['success']);

const userStore = useUserStore();

const orderTitle = ref('');
const orderDetail = ref<OrderApi.Order>();
const orderProcess = ref<OrderProcessApi.OrderProcess>();
const orderDetails = ref<OrderApi.OrderDetail[]>([]);
const loading = ref(false);
const printTime = ref(formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss'));
const printing = ref(false);
const exportingImage = ref(false);
/** 打印触发时的订单号，用于校验打印内容一致性（防止快速切换导致打印串单） */
let currentPrintingOrderNo: null | string = null;

/** 明细表最少渲染行数（不足补空行，贴近纸质单据样式） */
const MIN_ROWS = 20;

/**
 * 款式图列由几张开始走两列网格的"张数阈值"。
 * 与 CSS `.product-imgs.is-single` / `.product-imgs.is-multi` 切换口径一致：
 * 列表长度 ≤ 该值 → 单列纵向，否则 → 两列网格。
 *
 * 注意：这里只是"张数阈值"，**不要再当成像素 gap 用**——
 * 像素 gap 见 IMG_CELL_GAP_PX。
 */
const IMG_GRID_GAP = 2;
/**
 * 款式图布局里图片与图片之间的实际像素 gap。
 * 必须与 CSS 里 `.product-imgs` 的 gap 值保持一致，
 * 否则 calcImageGridHeight() 算出的"图片区总像素高"会跟浏览器真实渲染不一致，
 * 进而导致 rowspan 偏大、款式图列下方出现一段空白行。
 */
const IMG_CELL_GAP_PX = 8;
/**
 * 款式图视觉缩放系数（仅打印场景生效）。
 * 图片盒子宽度 = 父格子宽度 × 该系数 + 水平居中。
 * 配套效果：
 *   - CSS 上 .product-img 用 IMG_SCALE 取代 width: 100%；
 *   - DOM 上 <img>.clientWidth 自动变为 cellW × IMG_SCALE；
 *   - calcImageGridHeight() 直接从 DOM 读 clientWidth，
 *     所以 cellH、rowspan 都按比例缩小，不需要额外修改计算逻辑。
 * 调整该值即可微调"图片在版面上占多大"；0.95 = 小 5%。
 */
/** 明细行单元高度（与 .cell { height: 24px } 一致，用于把"像素"转成"行" */
const TABLE_ROW_PX = 24;
/** 款式图列里"状态行"占的 3 行（前 3 行是状态色块，第 4 行起才是图） */
const STATUS_ROWS_BEFORE_IMG = 3;

/** 把 setSize 原值翻译成 label；字典没声明的兜底用原值（避免自定义尺码被丢） */
const sizeLabelOf = (value: null | number | string | undefined) =>
  dictLabel(DICT_TYPE.ERP_SET_SIZE, String(value ?? '')) || String(value ?? '');

/** 当前打印用户 */
const printerName = computed(
  () => userStore.userInfo?.nickname || userStore.userInfo?.username || '',
);

/** 弹窗标题 */
const getTitle = computed(() =>
  orderDetail.value?.orderNo
    ? `${$t('common.print')} - ${orderDetail.value.orderNo}`
    : $t('common.print'),
);

/**
 * 打印专用 CSS：注入进 vue3-print-nb 的 iframe <head>。
 * vue3-print-nb 打印时会 clone DOM 进 iframe，但 Vue 的 scoped CSS
 * 不会跟着过来，所以边框等关键样式必须通过 extraHead 重新注入。
 */
function getPrintCss() {
  return `<style>
    * { box-sizing: border-box; }
    body { margin: 0 !important; padding: 0 !important; }
    html { margin: 0 !important; padding: 0 !important; }
    /* 关键：强制整个文档自适应高度，避免 vue3-print-nb 误判为"32k 页" */
    html, body { height: auto !important; }
    #orderPrintDiv {
      font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 12px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* 表格行高锁住，避免被图列带飞 + 浏览器反复 layout */
    #orderPrintDiv table.jls-table {
      width: 100%;
      border-collapse: collapse !important;
      border: none !important;
      outline: none !important;
      table-layout: fixed;
    }
    #orderPrintDiv table.jls-table td,
    #orderPrintDiv table.jls-table th {
      border: 1px solid #2f6fb5 !important;
      padding: 1.5pt 4pt;
      vertical-align: middle;
      word-break: break-all;
      text-align: center;
    }
    #orderPrintDiv table.jls-table td.val-area,
    #orderPrintDiv table.jls-table th.val-area {
      text-align: left;
      vertical-align: middle;
    }
    #orderPrintDiv table.jls-table .lbl {
      background: #c9d9ef;
      font-weight: 600;
      white-space: nowrap;
    }
    #orderPrintDiv table.jls-table .lbl-yellow { background: #ffff66; }
    #orderPrintDiv table.jls-table .lbl-orange { background: #f6c9a3; }
    #orderPrintDiv table.jls-table .lbl-tall { height: 40px; }
    #orderPrintDiv table.jls-table .val-red { color: #d40000; font-weight: 600; }
    #orderPrintDiv table.jls-table .val-fabric { background: #ffff00; font-weight: 700; }
    #orderPrintDiv table.jls-table .val-total { font-weight: 700; background: #f2f2f2; }
    #orderPrintDiv table.jls-table .cell { height: 24px; }
    #orderPrintDiv table.jls-table .title-cell {
      font-size: 18px;
      padding: 4px 0 10px;
    }
    /* 尺码统计：彩色加粗（即使额外 <style> 没注入，inline class 也兜底） */
    #orderPrintDiv .jls-stat-text {
      color: #d40000;
      font-weight: 700;
    }
    #orderPrintDiv .jls-print {
      max-width: 700px;
      margin: 0 auto;
      padding: 12px;
    }
    /* 款式图：is-single 单列纵向，is-multi 两列 min-content */
    #orderPrintDiv .product-imgs.is-single {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      height: auto;
      align-items: stretch;
    }
    #orderPrintDiv .product-imgs.is-multi {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: min-content;
      align-items: stretch;
      justify-items: stretch;
      gap: 8px;
      width: 100%;
      height: auto;
    }
    #orderPrintDiv .product-img {
      display: block;
      width: 100%;
      height: auto;
      object-fit: contain;
      background: #fff;
      min-height: 0;
    }
    #orderPrintDiv .product-imgs.is-single .product-img {
      width: 100%;
    }
    /* val-area 保留换行 */
    #orderPrintDiv .val-area {
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>`;
}

/**
 * 打印时临时改主窗口 document.title，作为浏览器保存 PDF 的文件名。
 *
 * Chromium（Chrome / Edge）在触发 window.print() 后是**异步读取主窗口 title**，
 * 几秒内路由 / 其他框架可能把它再改回去，于是保存对话框拿到的是错的标题。
 * 用 MutationObserver + beforeprint/afterprint 三道防线把 title 锁住：
 *  - beforeprint：开始守，并把当前 title 记下来供还原。
 *  - MutationObserver：发现 document.title 被改回，就立刻再写一次。
 *  - afterprint：取消观察、还原原 title、清理定时器。
 *
 * iframe 里也写一份 title 是为了兜 Firefox——Firefox 同步读 iframe 自己的 title。
 */

/**
 * 当前打印用的 iframe。
 * 库在 callback 期间还挂在 DOM 上，但 id 是 `printArea_${counter}` 自增，
 * 外部拿不到对应数字，缓存下来给 openCallback 用。
 */
let currentPrintIframe: HTMLIFrameElement | null = null;
let titleGuardCleanup: (() => void) | null = null;
/**
 * beforeOpenCallback 把 <img> 原 src 记下来，等关抽屉时（onOpenChange false）
 * 统一还原回去。**不**在 closeCallback 里还原——用户在预览框出来后经常
 * 点打印/取消多次，每次关都还原 → 下次开又要把 src 设回 dataURL 触发
 * 浏览器重新解码 RGBA，体感是"关卡 + 再开卡"。
 */
let pendingOriginalMap: Map<HTMLImageElement, string> | null = null;

/**
 * 把打印文件名作为 document.title 守住，防止 Vue Router / 其他代码
 * 在 chrome 异步读 title 的窗口内把它改掉。
 *
 * ⚠️ 重要：早期实现用 MutationObserver 在回调里写回 title，**Chrome 110+
 * 会把"赋相同字符串"也当作 mutation 触发回调**，形成自激死循环——
 * 栈展开时把所有 DOM 节点都打包到 GC root，几秒内 chrome 进程就能涨到 17GB。
 *
 * 现在的实现用"disconnect 包裹写入" + "写入标记位"两重防御：
 *   1) 进入 observer 回调时，先检查 title 是不是被外部代码改的（不是自己改的），
 *      才决定是否写回。
 *   2) 写回之前 disconnect observer，写完再 observe，**绝不会"自激"**。
 *   3) afterprint / 3s 后 cleanup 一定 disconnect + remove listener。
 */
function startTitleGuard(targetTitle: string) {
  // 已经有遗留的 guard 就先清掉，避免叠加
  titleGuardCleanup?.();

  const originalTitle = document.title;
  document.title = targetTitle;

  // 标记：observer 回调内被调时，如果是"我们自己刚写完的"就跳过。
  // 注意：必须用普通变量，不能挂 document.title 上（写完 title 立刻被还原太危险）。
  let isSelfWrite = false;

  // 只盯 <title> 节点本身（subtree:false），不要盯整个 head，
  // 否则 head 里任何节点变化都会触发回调。
  const titleEl = document.querySelector('title');
  const observeTarget = titleEl ?? document.head;

  const observer = new MutationObserver(() => {
    // 防御 1：自己刚写完的，跳过
    if (isSelfWrite) return;
    // 防御 2：title 已经是 target（写完但没等到 observer 收尾）跳过
    if (document.title === targetTitle) return;
    // 防御 3：title 已经被还原回 originalTitle（说明 print 已经结束），跳过
    if (document.title === originalTitle) return;

    // 写入前 disconnect 自身，**这是真正断掉自激循环的关键**——
    // 写完 document.title 不再触发任何 observer 回调。
    isSelfWrite = true;
    observer.disconnect();
    try {
      document.title = targetTitle;
    } finally {
      // 一帧后再 observe，避开本次写入的副作用
      requestAnimationFrame(() => {
        isSelfWrite = false;
        observer.observe(observeTarget, {
          childList: true,
          characterData: true,
          subtree: false,
        });
      });
    }
  });
  observer.observe(observeTarget, {
    childList: true,
    characterData: true,
    subtree: false,
  });

  // beforeprint：兜底某些浏览器同步读 title 的场景。
  const onBeforePrint = () => {
    if (document.title !== targetTitle) {
      isSelfWrite = true;
      observer.disconnect();
      try {
        document.title = targetTitle;
      } finally {
        requestAnimationFrame(() => {
          isSelfWrite = false;
          observer.observe(observeTarget, {
            childList: true,
            characterData: true,
            subtree: false,
          });
        });
      }
    }
  };
  // afterprint：浏览器读完 title 后再还原 + 彻底清理。
  const onAfterPrint = () => {
    document.title = originalTitle;
  };
  window.addEventListener('beforeprint', onBeforePrint, { once: true });
  window.addEventListener('afterprint', onAfterPrint, { once: true });

  titleGuardCleanup = () => {
    observer.disconnect();
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', onAfterPrint);
    // 3 秒后强制还原（Chrome 异步读 title 大概就是几百 ms，留点余量）
    window.setTimeout(() => {
      // 防止"清理期间又被别的代码改回"的副作用：直接 disconnect
      observer.disconnect();
      document.title = originalTitle;
      titleGuardCleanup = null;
    }, 3000);
  };
}

const printObj = computed(() => {
  return {
    id: '#orderPrintDiv',
    popTitle: '',
    standard: 'html5',
    zIndex: 20_002,
    extraHead: getPrintCss(),
    /**
     * 在库 createPrintWindow() 之后、实际打印前调一次。
     *
     * 注意：用户点击瞬间 loading 已经在 @click 监听器里亮起（见 handlePrintClick），
     * 这里只做"命中缓存替换 src"——纯字符串 O(N)，不调 canvas，**绝不卡**。
     *
     * PDF 路径内存爆炸修复（用户实测 17GB）：<img> 拿到的已经是 800px JPEG dataURL，
     * vue3-print-nb cloneNode(true) → 写进 iframe.document → 浏览器渲染预览 →
     * 序列化 PDF 的整个链路，**4K 原图不再被解码为 RGBA 位图**。
     */
    beforeOpenCallback() {
      const iframes = document.querySelectorAll<HTMLIFrameElement>(
        'iframe[id^="printArea_"]',
      );
      currentPrintIframe = iframes[iframes.length - 1] ?? null;
      currentPrintingOrderNo = orderDetail.value?.orderNo ?? null;

      const printEl = document.querySelector<HTMLElement>('#orderPrintDiv');
      if (printEl) {
        // 命中缓存替换 src（同步、O(N)、不调 canvas）。
        // originalMap 用闭包变量存，**不**挂在 iframe 节点上——因为现在
        // closeCallback 不会立刻还原，所以等不到下一次打印时再覆盖也无所谓。
        pendingOriginalMap = applyPrintImageCache(printEl);
      }
    },
    openCallback() {
      // 防御：打印时校验当前 DOM 数据是否与触发打印时的订单一致
      if (
        currentPrintingOrderNo &&
        orderDetail.value?.orderNo !== currentPrintingOrderNo
      ) {
        message.warning('订单已切换，打印已取消');
        printing.value = false;
        return;
      }
      const title =
        orderTitle.value ||
        `JLS制单-${orderDetail.value?.customer ? `${orderDetail.value?.customer}-` : ''}${orderDetail.value?.name ? `${orderDetail.value?.name}-` : ''}-${orderDetail.value?.orderNo}`;
      // Firefox：同步读 iframe 自己的 title
      const doc = currentPrintIframe?.contentDocument;
      if (doc) doc.title = title;
      // Chromium：异步读主窗口的 title，用 guard 守住
      startTitleGuard(title);
      // 去更新订单打印。失败仅打日志，不影响打印流程；
      // success 推到下个 tick，避免任何潜在的同步递归（父组件 onSuccess
      // 不应阻塞到 iframe.document.write 完成后才返回）。
      if (
        orderDetail.value?.printStatus === ErpOrderPrintStatus.PRINT_STATUS_1
      ) {
        return;
      }
      printOrder(orderDetail.value?.orderNo!)
        .catch((error) => {
          console.warn('[print] printOrder failed', error);
        })
        .finally(() => {
          Promise.resolve().then(() => {
            emit('success');
          });
        });
    },
    closeCallback() {
      // 关闭预览框（用户点打印/取消）**绝不**还原 src、**绝不**删 iframe。
      //
      // 理由（用户反馈）：用户在预览框出来后经常点打印/取消多次，
      // 或者关掉预览再立刻再开 → 如果每次关闭都还原 src，下一轮
      // applyPrintImageCache 又要同步设 8 张图 dataURL → 浏览器重新
      // 解码 RGBA → "重新点击打印也会卡"。
      //
      // 现在的语义：
      //   - 打开预览框：applyPrintImageCache 把 src → dataURL
      //   - 关闭预览框：什么都不做，dataURL 保留在 DOM 上
      //   - 再开预览框：applyPrintImageCache 扫描所有 <img>，
      //     dataURL 被 isCachableImgSrc(dataURL) === false 全部跳过 → 零开销
      //   - 关抽屉：onOpenChange(false) 统一还原 src + 删 iframe

      // a) 关 loading —— 用户最在意的"按钮恢复可点"
      printing.value = false;
      currentPrintingOrderNo = null;

      // b) 立刻清理 title guard —— 关预览后 Vue Router / 其他代码会改
      //    document.title，挂在上面的 MutationObserver 会在 3s setTimeout
      //    兜底清理前持续触发；这里立即 disconnect 就把那段抖动掐掉。
      titleGuardCleanup?.();
      titleGuardCleanup = null;
    },
  };
});

/** 暴露给父组件 */
defineExpose({ printObj });

/**
 * 用户点"打印"按钮的瞬间触发：立刻把 loading 置 true，让用户视觉上
 * 看到反馈。vue3-print-nb 的 v-print 指令在 click 之后才进入
 * beforeOpenCallback → cloneNode → iframe.document.write → window.print()，
 * 整个链路在用户感知里就是"我点完了，loading 应该亮"。
 *
 * 但 v-print 的 callback（beforeOpenCallback 等）**比 @click 晚一个 tick**
 * 才到；我们这里在 @click 里同步设 loading.value = true，Vue 立刻 schedule
 * render，下一帧前 button 的 :loading="printing" 已经为 true → loading 转圈
 * 出现远早于 vue3-print-nb 完成 iframe 写入。
 */
function onPrintClick() {
  printing.value = true;
}

/** 日期格式化 */
function formatDateValue(value: Dayjs | number | string | undefined) {
  if (value === undefined || value === null || value === '') return '';
  return formatDate(value as Date | number | string);
}

/** 字典标签通用转换 */
function dictLabel(type: string, value: number | string | undefined) {
  if (value === undefined || value === null || value === '') return '';
  return getDictLabel(type, value);
}

/**
 * 把图片字段拆成数组。orderImage 支持多种来源：
 *  - 字符串：||  / 逗号 / 分号 / 换行 分隔（兼容旧数据）
 *  - 数组
 * 拆完后只过滤掉空串，原样保留 URL。
 * 任何 URL 编码/解码都不在这里做，让浏览器自己处理；
 * 万一 URL 真坏掉了就让图片破图显示，不要再走 encode/decode 逻辑。
 */
const orderImages = computed<string[]>(() => {
  const raw = (orderDetail.value as any)?.orderImage;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(/\|\||[,;\n]/);
  return arr.map((s: unknown) => String(s ?? '').trim()).filter(Boolean);
});

/**
 * Issue 4：根据款式图实际尺寸 + 列宽算出"明细区要补多少行"。
 *
 * 设计要点：
 *  - 不重新发网络请求加载图片尺寸——直接读 DOM 里已经渲染的 <img>
 *    元素的 naturalWidth/Height（浏览器缓存命中时是同步可读的）。
 *  - 未加载完成的图（naturalWidth/Height === 0）直接跳过、不计入，
 *    等下一轮 watcher（图片 load 完成）再补算；
 *    绝不能按 1:1 兜底成"正方形"，否则横向款式图 cellH 翻倍，
 *    会把 rowspan 撑大、款式图列下方凭空多出几行空白。
 *  - 监听 orderImages 变化 → 在 DOM 更新完成 (flush: 'post') 后再算。
 */
const productImgsHeightPx = ref(0);

/**
 * 实时量 DOM 里 td.img-panel 的实际渲染净宽（不含 padding），
 * 再用 naturalWidth/Height 模拟 grid 布局算出图片区总像素高。
 * 量 DOM 宽度 → 预览和导出用同一个计算基准 → rowCount 完全一致。
 *
 * 关键坑（保留计算结果跟浏览器实际渲染完全一致）：
 *   1. <img> 的 naturalWidth/naturalHeight 必须 > 0 才能参与计算。
 *      没加载完时 aspect 兜底成 1（正方形）会把横向款式图 cellH 翻倍，
 *      直接撑大 rowspan → 图列下方凭空多出几行空白。这里**跳过该图不计入**，
 *      而不是用 1 兜底。
 *   2. 图片间隙用 IMG_CELL_GAP_PX（=8px），跟 CSS .product-imgs 的 gap 同源，
 *      不再复用 IMG_GRID_GAP（那是"张数阈值"，不是像素）。
 *   3. **cellWidth 必须从 DOM 实际渲染的 img 上取**，不能纯靠
 *      `(contentWidth - gap) / cols` 算 —— 预览抽屉（~570px）和导出
 *      临时容器（固定 700px）外层宽度不同；两个端算出来的 cellWidth
 *      可以差 30~50px，导致同一份图在两边算出不同 rowspan，导出版"多几行"。
 *      直接读 domImgs[i].clientWidth（浏览器分给该 <img> 的实际像素宽）
 *      作为 cellWidth，aspect 用 naturalWidth/Height 推 cellH，
 *      函数与浏览器渲染 100% 同源。
 */
function calcImageGridHeight(): number {
  const td = document.querySelector<HTMLElement>('#orderPrintDiv td.img-panel');
  if (!td) return 0;

  const domImgs: HTMLImageElement[] = [
    ...document.querySelectorAll<HTMLImageElement>(
      '#orderPrintDiv img.product-img',
    ),
  ];

  // 列数：≤IMG_GRID_GAP 张 → 单列；>IMG_GRID_GAP 张 → 两列网格。
  // 与 CSS .product-imgs.is-single / .product-imgs.is-multi 切换口径一致。
  const cols = orderImages.value.length <= IMG_GRID_GAP ? 1 : 2;

  // 这里只用"已经在 DOM 里、naturalWidth/naturalHeight 都有效"的图来算高度。
  // 没加载完的图直接跳过，等下一轮 watcher 重新跑。
  const ready: { cellH: number; cellW: number }[] = [];
  for (let i = 0; i < orderImages.value.length; i++) {
    const dom = domImgs[i];
    const w = dom?.naturalWidth ?? 0;
    const h = dom?.naturalHeight ?? 0;
    if (w <= 0 || h <= 0) continue;
    // cellWidth 从 DOM 拿 —— 浏览器分给该 <img> 的真实像素宽。
    // 这能彻底消除"外层容器宽不一样"带来的 colspan/rowspan 漂移。
    // 单图兜底：偶尔 img 还在某个未 layout 的中间状态，clientWidth=0；
    // 这时候跳过，下一轮再算。
    const cellW = dom?.clientWidth ?? 0;
    if (cellW <= 0) continue;
    const aspect = w / h;
    ready.push({ cellW, cellH: cellW / aspect });
  }

  if (ready.length === 0) return 0;

  // 用 ready 重排 cells 到 cols 列网格的行高（max per row）。
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

/** 款式图容器 class：≤IMG_GRID_GAP 张纵向单列，>IMG_GRID_GAP 张两列 */
const imageLayoutClass = computed(() =>
  orderImages.value.length > IMG_GRID_GAP ? 'is-multi' : 'is-single',
);

/**
 * 等 DOM 提交、<img> 元素已经在节点树里之后，
 * 再从 naturalWidth/Height 算一次图片区高度。
 * 关闭弹窗 / 切换订单 → watch 重新触发；首次进来 → nextTick 也覆盖到。
 */
function recomputeImgsHeight() {
  productImgsHeightPx.value = calcImageGridHeight();
}

watch(
  orderImages,
  async () => {
    if (orderImages.value.length === 0) {
      productImgsHeightPx.value = 0;
      return;
    }
    // DOM 已 patch、img 元素已挂上 → 等图片加载完成后再计算真实高度
    // （naturalWidth/Height 在图片未加载完时为 0，按 1:1 兜底会导致行数严重不准）
    await nextTick();
    const imgs = [
      ...document.querySelectorAll<HTMLImageElement>(
        '#orderPrintDiv img.product-img',
      ),
    ];
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        });
      }),
    );
    recomputeImgsHeight();

    // 抽屉打开后立刻让图加载；图加载完后预热压缩缓存。
    // 用户点打印时直接命中缓存，毫秒级完成压图，**不卡顿**。
    const printEl = document.querySelector<HTMLElement>('#orderPrintDiv');
    if (!printEl) return;
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void) => number)
      | undefined;
    if (ric) {
      ric(() => {
        void prewarmDownsampleCache(printEl);
      });
    } else {
      setTimeout(() => {
        void prewarmDownsampleCache(printEl);
      }, 0);
    }
  },
  { immediate: true },
);

/** 二维码图（qrCode 支持多张图片：||  / 逗号 / 分号 / 换行 分隔，
 * 多张图全部居中、限定宽高，整体看起来是一个统一图块）。
 * 与 orderImages 解析规则保持一致，便于样式与口径统一。 */
const qrCodes = computed<string[]>(() => {
  const raw = (orderDetail.value as any)?.qrCode;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(/\|\||[,;\n]/);
  return arr.map((s: unknown) => String(s ?? '').trim()).filter(Boolean);
});

/**
 * 二维码 td 实际净空（与 use-order-print.ts / CSS 保持一致）：
 *   qr-cell：colspan=4 × 700 / 12 ≈ 233px 宽；rowspan=4 × 24 = 96px 高；
 *   扣 1px 边框双向 → 约 231×94px。
 *
 * 按张数算每张图的具体像素尺寸（写死 px，不用 aspect-ratio / max-height %），
 * 直接 inline style 到 <img>，这样打印 PDF / 截图 都不会被 iframe / 浏览器渲染差异坑。
 *
 * 规则：
 *   - 单张：父级高 90% × 宽 90% 取 min = 约 85px（接近正方形，跟父级同比例）。
 *   - 多张：每张 = min((可用宽 - gap) / 张数, 可用高 - 4)，最少 18px 兜底。
 */
const QR_CELL_INNER_WIDTH = (700 * 4) / 12 - 2; // ≈ 231
const QR_CELL_INNER_HEIGHT = 4 * 24 - 2; // 94
const qrItemSize = computed(() => {
  const n = qrCodes.value.length;
  if (n === 0) return '';
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
});

/** 明细人员列表（名字/号码/尺码/备注） */
const personList = computed(() =>
  orderDetails.value.map((row) => ({
    name: (row as any).setName ?? '',
    number: row.setNumber ?? '',
    size: dictLabel(DICT_TYPE.ERP_SET_SIZE, row.setSize),
    remark: (row as any).remark ?? '',
  })),
);

/**
 * 尺码 => 数量 汇总
 *
 * 排序口径：**按订单详情 orderDetails 中 setSize 首次出现的下标升序**——
 * 这样"尺码统计行"与详情里尺码出现的顺序一一对应，看起来不"乱"。
 *
 * 关键坑：
 *   1. 同一尺码多次出现要累加（不变）。
 *   2. **字典没声明的尺码不能丢**。原实现用 `sizeSortList.filter(has)`，
 *      会把字典之外的尺码直接过滤掉。改用 `sizeLabelOf(value)` 兜底——
 *      字典有就用字典 label，没有就用原值，避免自定义尺码消失在统计里。
 *   3. firstIdx 用累加时第一次写入的下标（不是 min），保证"详情顺序"语义清晰。
 */
const sizeSummary = computed(() => {
  const acc = new Map<
    string,
    { firstIdx: number; label: string; qty: number }
  >();
  orderDetails.value.forEach((row, idx) => {
    const size = row.setSize;
    const qty = Number(row.setQuantity) || 0;
    if (size === undefined || size === null || size === '' || qty <= 0) return;
    const key = String(size);
    const existed = acc.get(key);
    if (existed) {
      existed.qty += qty;
    } else {
      acc.set(key, { label: sizeLabelOf(size), qty, firstIdx: idx });
    }
  });
  return [...acc.values()]
    .sort((a, b) => a.firstIdx - b.firstIdx)
    .map(({ label, qty }) => ({ label, qty }));
});

/** 汇总总数量 */
const sizeTotal = computed(() =>
  sizeSummary.value.reduce((sum, i) => sum + i.qty, 0),
);

/** 尺码汇总行（含“总计”行） */
const sizeRows = computed(() => [
  ...sizeSummary.value.map((i) => ({ ...i, isTotal: false })),
  { label: '总计', qty: sizeTotal.value, isTotal: true },
]);

/**
 * 订单状态 / 提货方式 / 领型 三个状态格子
 *
 * 全部走字典（erp_order_status / erp_order_pickup_method / erp_neckline），
 * 不再硬编码 '正常' '中通' '圆领' —— 字典改了名字这里会自动跟上。
 * 字典查不到值时返回空串，由 .val 占位，避免出现误导的"占位词"。
 */
/**
 * 订单状态/标题颜色逻辑：
 * - 状态为 3（正常）→ 绿底黑字
 * - 其他状态 → 黑底红字
 */

/** 判断是否为"正常"状态（orderStatus === 3） */
function isNormalStatus(): boolean {
  return orderDetail.value?.orderStatus === '1';
}

interface StatusCell {
  label: string;
  cls: string;
  style?: { color?: string; fontWeight: number };
}

/** 订单状态格子样式 */
function buildOrderStatusCell(): StatusCell {
  const label = dictLabel(
    DICT_TYPE.ERP_ORDER_STATUS,
    orderDetail.value?.orderStatus,
  );
  const normal = isNormalStatus();
  return {
    label,
    cls: normal ? 'status-green' : 'status-red',
    style: normal ? undefined : { fontWeight: 700 },
  };
}

/** 标题样式：非正常状态红底黑字，正常状态无背景色 */
const titleStyle = computed(() =>
  isNormalStatus()
    ? {}
    : { background: '#ff4d4f', color: '#000' },
);

const statusCells = computed<StatusCell[]>(() => [
  buildOrderStatusCell(),
  {
    label: dictLabel(
      DICT_TYPE.ERP_ORDER_PICKUP_METHOD,
      orderDetail.value?.pickupMethod,
    ),
    cls: 'status-mid',
  },
  {
    label: dictLabel(DICT_TYPE.ERP_NECKLINE, orderProcess.value?.neckline),
    cls: 'status-neck',
  },
]);

/**
 * 明细区总行数 = 人员/尺码/MIN_ROWS 三者最大值，
 * 但款式图列（rowspan = rowCount - 3）必须能装下全部图片，
 * 否则图被压缩、左边的"姓名/号码"行高会被图列带飞（Issue 4）。
 */
const requiredImageRows = computed(() =>
  Math.ceil(productImgsHeightPx.value / TABLE_ROW_PX),
);
const rowCount = computed(() => {
  const base = Math.max(personList.value.length, MIN_ROWS);
  // 图列至少需要 N 行，加上前面 3 行状态行 → 总行数最少 N + 3
  const needForImages = requiredImageRows.value + STATUS_ROWS_BEFORE_IMG;
  return Math.max(base, needForImages);
});
const rowIndexes = computed(() =>
  Array.from({ length: rowCount.value }, (_, i) => i),
);

/** 加载完整打印数据 */
async function loadPrintData(orderNo: string) {
  loading.value = true;
  try {
    const order = await getOrderDetailNo(orderNo);

    orderDetail.value = order;
    orderProcess.value = order?.orderProcess;
    orderDetails.value = (order?.orderDetails ?? []).filter(
      (row) => row.setSize && Number(row.setQuantity) > 0,
    );
    orderTitle.value = `JLS制单-${orderDetail.value.customer ? `${orderDetail.value.customer}-` : ''}${orderDetail.value.name ? `${orderDetail.value.name}-` : ''}${orderDetail.value.orderNo}-${dictLabel(
      DICT_TYPE.ERP_ORDER_PICKUP_METHOD,
      orderDetail.value?.pickupMethod,
    )}`;
    printTime.value = formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss');
  } finally {
    loading.value = false;
  }
}

/** 等待单据内图片加载完成，避免导出的 PNG 缺少二维码或款式图。 */
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
 * 导出图片专用：原 DOM 的样式已由 jls-print 等全局规则覆盖好，
 * 这里只是占位 hook——目前不需要再覆写任何 CSS。
 *
 * 早期版本曾在这里给 .product-img / .qr-img 加 max-height: 600px
 * 限制 4K 原图，但这条规则对**导出图片画质是反效果**——
 * 它直接压低款式图清晰度。导出图片走 cloneNode + html-to-image，
 * 单图清晰度由克隆体尺寸 + pixelRatio 决定，**不要再压图**。
 */

/** 一次性缓存：只取"非 CSS 变量"的属性名，传给 toPng 跳过 CSS 变量拷贝 */
let cachedNonCustomPropNames: null | string[] = null;

function getNonCustomPropNames() {
  if (cachedNonCustomPropNames) return cachedNonCustomPropNames;
  const names: string[] = [];
  const style = getComputedStyle(document.documentElement);
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i);
    if (name.startsWith('--')) continue;
    names.push(name);
  }
  cachedNonCustomPropNames = names;
  return names;
}

/** 单边最大像素（宽或高）。款式图渲染到 700px 容器内最多占用 6/12 = 350px，
 * 缩到 800px 还有 2× 余量，足够 A4 打印清晰；4K 原图缩到这里
 * 单张可控制在 200KB 以内，内存占用 ≈ 800×800×4 = 2.5MB。 */
const IMG_DOWNSAMPLE_MAX = 800;
/** 输出 JPEG 质量。0.85 视觉差异微小，体积比 PNG 小 1/3。 */
const IMG_DOWNSAMPLE_QUALITY = 0.85;

/**
 * 图片压缩缓存：原图 src → 800px JPEG dataURL。
 *
 * 用途：在抽屉打开、款式图加载完毕后**后台预热**；点打印时直接命中缓存，
 * cloneNode 写入 iframe 时拿到的就是 dataURL 短串，浏览器不再做 RGBA 解码，
 * 这正是之前 17GB 内存爆炸的修复核心。
 *
 * 为什么不直接改 <img>.src（变成 dataURL）显示给用户看：
 *   - 用户屏幕上要看的还是原图清晰度。
 *   - 只在打印路径**临时**替换 src，打印结束 (closeCallback) 再还原，
 *     这样屏幕显示 / 打印预览 / 导出图片 三条路径各自拿各自的资源，互不污染。
 *
 * 缓存粒度：按原始 src 字符串做 key。如果同一订单里同 src 出现多次（不可能），
 * 也只压缩一次。
 */
const downsampleCache = new Map<string, string>();
/** 同一订单反复打印 / 切单再回来时，复用上一次压好的 dataURL。 */
let lastOrderCacheKey = '';

function getOrderCacheKey(): string {
  // 用款式图 URL 串作 fingerprint，足以区分订单
  return orderImages.value.join('|');
}

function isCachableImgSrc(src: string): boolean {
  if (!src) return false;
  // 已经是 inline dataURL 的不能再压
  if (src.startsWith('data:')) return false;
  // blob: 也跳过（通常浏览器内部使用，不会有大图）
  if (src.startsWith('blob:')) return false;
  return true;
}

/**
 * 单张图：离线缩放到 IMG_DOWNSAMPLE_MAX 像素内，返回 JPEG dataURL。
 * 失败（CORS 污染 canvas 等）返回原 src，调用方照常把它写进缓存 = 原图。
 */
function buildDownsampledDataUrl(img: HTMLImageElement): string {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w === 0 || h === 0) return img.src;
  if (w <= IMG_DOWNSAMPLE_MAX && h <= IMG_DOWNSAMPLE_MAX) return img.src;

  const scale = Math.min(IMG_DOWNSAMPLE_MAX / w, IMG_DOWNSAMPLE_MAX / h, 1);
  const newW = Math.max(1, Math.round(w * scale));
  const newH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;

  try {
    ctx.drawImage(img, 0, 0, newW, newH);
    return canvas.toDataURL('image/jpeg', IMG_DOWNSAMPLE_QUALITY);
  } catch {
    return img.src;
  }
}

/**
 * 后台预热压缩缓存：扫 root 下所有 <img>，把没缓存的塞进 Map。
 *
 * 调用时机：订单数据加载完成 + nextTick 后用 requestIdleCallback 推一帧，
 * 让 UI 优先渲染；不会阻塞主线程。
 *
 * 返回一个 Promise——外部可以选择 await 它（一般不 await）。
 */
async function prewarmDownsampleCache(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll<HTMLImageElement>('img')];
  if (imgs.length === 0) return;

  const newKey = getOrderCacheKey();
  const orderChanged = newKey !== lastOrderCacheKey;
  if (orderChanged) {
    // 切单 / 关抽屉后回来：旧缓存里可能含失效图（图片 URL 在 OSS 上理论上永不过期，
    // 但保守起见订单切换时清空一次）。
    downsampleCache.clear();
    lastOrderCacheKey = newKey;
  }

  const tasks: Promise<void>[] = [];
  for (const img of imgs) {
    const src = img.src;
    if (!isCachableImgSrc(src)) continue;
    if (downsampleCache.has(src)) continue;
    if (!img.complete || img.naturalWidth === 0) {
      // 图还没加载完，跳过这一张；下次 watch 触发时会再试一次。
      continue;
    }

    // 单张压图本身是同步 CPU 密集（toDataURL 是同步），但单张一般 <200ms；
    // 把它丢到 setTimeout(0) 里让本帧先返回，多张图串行分散到多个 tick，
    // 不会卡死点击响应。
    tasks.push(
      new Promise<void>((resolve) => {
        setTimeout(() => {
          const dataUrl = buildDownsampledDataUrl(img);
          downsampleCache.set(src, dataUrl);
          resolve();
        }, 0);
      }),
    );
  }
  await Promise.all(tasks);
}

/**
 * 把缓存命中、且需要压缩的 <img> 的 src 替换成 800px JPEG dataURL。
 *
 * 同步、O(N)、不调任何 canvas API——纯 DOM 字符串替换，**绝对不卡**。
 * 这才是真正解决"点击打印时同步压图卡顿"的修复点。
 *
 * 同时返回 originalMap 给 closeCallback 用：把 src 还原回去。
 */
function applyPrintImageCache(
  root: HTMLElement,
): Map<HTMLImageElement, string> {
  const originalMap = new Map<HTMLImageElement, string>();
  const imgs = [...root.querySelectorAll<HTMLImageElement>('img')];
  for (const img of imgs) {
    const src = img.src;
    if (!isCachableImgSrc(src)) continue;

    const cached = downsampleCache.get(src);
    if (!cached) continue;
    if (cached === src) continue; // 没真压过（小图），原 src 显示即可

    originalMap.set(img, src);
    img.src = cached;
    img.dataset.printDowned = '1';
  }
  return originalMap;
}

/** 将完整打印区域导出为一张高清 PNG。

 * 关键修复：drawer 里的 #orderPrintDiv 宽度受抽屉视口约束（max-width: 900px
 * 在 w-[75%] 抽屉里实际只能拿到 ~570px），html-to-image 拿到的画布宽度被压窄，
 * 表格右侧（款式图列 + 二维码列）被切掉。
 * 解决：把 #orderPrintDiv 克隆到屏幕外固定 700px 容器里再截图。
 * 款式图列高度 / rowspan 沿用文件里已有的 productImgsHeightPx / rowCount
 * （已经是按 700px 基准算好的），不在这里再算一遍。
 *
 * 注意：导出图片要保持高清（pixelRatio:2），不要在这里压图。
 * 打印 PDF 的内存爆炸问题另有解——见 printObj 的 beforeOpenCallback。
 */
async function exportAsImage() {
  const sourceEl = document.querySelector<HTMLElement>('#orderPrintDiv');
  if (!sourceEl || !orderDetail.value || exportingImage.value) return;

  const currentOrderNo = orderDetail.value.orderNo;

  exportingImage.value = true;
  const offScreenContainer = document.createElement('div');
  offScreenContainer.style.cssText =
    'position:fixed;left:-99999px;top:0;width:700px;z-index:-1;pointer-events:none;background:#fff;';
  // 不再注入额外 <style> 覆写 —— 早期版本里有 max-height: 600px 这类规则
  // 反而压低了导出图清晰度。原 DOM 自身样式由 .jls-print 等全局规则覆盖好。

  const clonedEl = sourceEl.cloneNode(true) as HTMLElement;
  offScreenContainer.append(clonedEl);
  document.body.append(offScreenContainer);

  try {
    await waitForImages(clonedEl);
    await document.fonts?.ready;

    const dataUrl = await toPng(clonedEl, {
      backgroundColor: '#ffffff',
      // pixelRatio:3 → 实际画布 700×3 = 2100px 宽，比之前 2 倍再高 50%。
      // 不要在这里写 canvasWidth —— 显式设 canvasWidth 会让 h2i 创建比克隆体
      // 宽得多的画布，**右侧 1400px 是空画布**（虽然 backgroundColor 是白色，
      // 但 h2i 在某些版本里 backgroundColor 与 width/canvasWidth 错配时
      // 不会真正铺满背景，会留灰色），导致导出图出现"右边一长条灰色背景"。
      // 让 h2i 自己按 width × pixelRatio 算画布 = 2100px，完全匹配克隆体
      // 实际渲染宽度，无空白区。
      pixelRatio: 3,
      cacheBust: false,
      includeStyleProperties: getNonCustomPropNames(),
      width: 700,
      style: {
        transform: 'none',
        transformOrigin: 'top left',
      },
      // 字体完整嵌入，不让 toDataURL 阶段丢字（保证中文不糊）
      skipFonts: false,
    });

    if (orderDetail.value?.orderNo !== currentOrderNo) {
      message.warning('订单已切换，导出已取消');
      return;
    }

    const rawFileName =
      orderTitle.value ||
      `JLS制单-${orderDetail.value.customer ? `${orderDetail.value.customer}-` : ''}${orderDetail.value.name ? `${orderDetail.value.name}-` : ''}${orderDetail.value.orderNo}`;
    const fileName = rawFileName.replaceAll(/[<>:"/\\|?*]/g, '-');

    // html-to-image 走 SVG → 浏览器解码 → Canvas → dataURL，
    // 跨域图片如果污染了 Canvas，toDataURL 会抛 SecurityError；
    // 用 fetch 转 blob 再 URL.createObjectURL 绕过污染问题。
    let href: string;
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      href = URL.createObjectURL(blob);
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      href = dataUrl; // 兜底：跨域不严重时直接用 dataURL
    }

    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = href;
    link.click();

    if (orderDetail.value?.orderNo !== currentOrderNo) {
      message.warning('订单已切换，导出已取消');
      return;
    }

    message.success('图片导出成功');
  } catch (error) {
    console.error('导出订单图片失败', error);
    message.error('图片导出失败，请检查款式图是否允许跨域访问');
  } finally {
    offScreenContainer.remove();
    exportingImage.value = false;
  }
}

const [ModalDrawer, modalDrawerApi] = useVbenModelDrawer({
  async onConfirm() {
    await modalDrawerApi.close();
    // 如果已经打印过了，不提示父组件了
    if (orderDetail.value?.printStatus === ErpOrderPrintStatus.PRINT_STATUS_1) {
      emit('success');
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      // 抽屉关闭：把当前所有被压过的 <img> src 还原回原 URL。
      // 这是**唯一**做"还原 + 删 iframe"的时机——关预览框不还原（避免下次
      // 再开时 applyPrintImageCache 重新同步设 8 张 dataURL 又触发解码卡顿）。
      // 此时抽屉正在关 → 用户不会再看 #orderPrintDiv → 8 张图同时解码
      // **视觉上无感知**，反而省得在预览框关闭的"立刻"卡。
      if (pendingOriginalMap && pendingOriginalMap.size > 0) {
        for (const [img, src] of pendingOriginalMap) {
          if (img.isConnected) {
            img.src = src;
            delete img.dataset.printDowned;
          }
        }
        pendingOriginalMap = null;
      }

      // vue3-print-nb 不一定清 printArea iframe——关抽屉时一起清掉
      if (currentPrintIframe?.parentNode) {
        currentPrintIframe.remove();
      }
      currentPrintIframe = null;
      currentPrintingOrderNo = null;

      orderDetail.value = undefined;
      orderProcess.value = undefined;
      orderDetails.value = [];
      // 抽屉关闭：清空预热缓存，避免下次打开另一个订单时命中旧 dataURL
      // （理论上一张订单的所有款式图 URL 在 OSS 上永不过期，但保守起见
      // 关抽屉就清，让切换订单时重新预热一次，逻辑也更可预测）
      downsampleCache.clear();
      lastOrderCacheKey = '';
      return;
    }
    const data = modalDrawerApi.getData<OrderApi.Order>();
    if (!data || !data.orderNo) return;
    modalDrawerApi.lock();
    try {
      orderDetail.value = undefined;
      await nextTick();
      await loadPrintData(data.orderNo);
    } finally {
      modalDrawerApi.unlock();
    }
  },
});
</script>

<template>
  <ModalDrawer
    :title="getTitle"
    class="w-[75%]"
    :show-confirm-button="false"
    :cancel-text="$t('ui.actionTitle.cancel')"
  >
    <Spin :spinning="loading">
      <div v-if="orderDetail" class="jls-wrap">
        <div id="orderPrintDiv" class="jls-print">
          <!-- 整张单据 = 一个表格 + 12 等分基准列，全部用 colspan/rowspan 合并 -->
          <table class="jls-table">
            <colgroup>
              <col v-for="n in 12" :key="n" style="width: 8.333%" />
            </colgroup>

            <tbody>
              <!-- 标题 -->
              <tr>
                <th class="cell title-cell" colspan="12" :style="titleStyle">
                  {{ orderTitle }}
                </th>
              </tr>

              <!-- 顶部信息区 第一行（布料 label+value 向下合并 2 行） -->
              <tr>
                <th class="cell lbl" colspan="2">版型</th>
                <th class="cell lbl" colspan="2">客户-队名</th>
                <th class="cell lbl" colspan="1">数量</th>
                <th class="cell lbl" colspan="2">下单日期</th>
                <th class="cell lbl" colspan="2">发货日期</th>
                <th class="cell lbl lbl-orange" colspan="1" rowspan="2">
                  布料
                </th>
                <td class="cell val-fabric" colspan="2" rowspan="2">
                  {{ dictLabel(DICT_TYPE.ERP_FABRIC, orderDetail.fabric) }}
                </td>
              </tr>
              <!-- 顶部信息区 第二行 -->
              <tr>
                <td class="cell val val-red" colspan="2">
                  {{ dictLabel(DICT_TYPE.ERP_PATTERN, orderDetail.pattern) }}
                </td>
                <td class="cell val" colspan="2">
                  {{ orderDetail.name ?? '' }}
                </td>
                <td class="cell val val-red" colspan="1">
                  {{ orderDetail.number ?? '' }}
                </td>
                <td class="cell val val-red" colspan="2">
                  {{ formatDateValue(orderDetail.orderTime) }}
                </td>
                <td class="cell val val-red" colspan="2">
                  {{ formatDateValue(orderDetail.exceptShippingTime) }}
                </td>
              </tr>

              <!-- 工艺行 -->
              <tr>
                <th class="cell lbl" colspan="1">品类</th>
                <td class="cell val val-red" colspan="2">
                  {{
                    dictLabel(DICT_TYPE.ERP_CATEGORY, orderProcess?.category)
                  }}
                </td>
                <td class="cell val val-red" colspan="2">
                  {{
                    dictLabel(
                      DICT_TYPE.ERP_SPECIFICATION,
                      orderProcess?.specification,
                    )
                  }}
                </td>
                <th class="cell lbl" colspan="1">开衩与否</th>
                <td class="cell val val-red" colspan="1">
                  {{
                    dictLabel(DICT_TYPE.ERP_HAS_FORKED, orderProcess?.hasForked)
                  }}
                </td>
                <th class="cell lbl" colspan="1">衫脚</th>
                <td class="cell val val-red" colspan="1">
                  {{
                    dictLabel(DICT_TYPE.ERP_SHIRT_HEM, orderProcess?.shirtHem)
                  }}
                </td>
                <th class="cell lbl" colspan="1">口袋</th>
                <td class="cell val val-red" colspan="2">
                  {{ dictLabel(DICT_TYPE.ERP_POCKET, orderProcess?.pocket) }}
                </td>
              </tr>

              <!-- 特别备注 -->
              <tr>
                <th class="cell lbl lbl-tall" colspan="1">特别备注</th>
                <td class="cell val val-area" colspan="11">
                  {{ orderDetail.remark ?? '' }}
                </td>
              </tr>

              <!-- 车间要求 -->
              <tr>
                <th class="cell lbl lbl-tall" colspan="1">车间要求</th>
                <td class="cell val val-area jls-emph-red" colspan="11">
                  {{ orderProcess?.workshopRequirements ?? '' }}
                </td>
              </tr>

              <!-- 尺码统计：一行内展示 尺码-数量、尺码-数量 ... 总计-N -->
              <tr>
                <th class="cell lbl" colspan="1">尺码统计</th>
                <td class="cell val val-area jls-stat-text" colspan="11">
                  <template v-if="sizeRows.length > 0">
                    {{ sizeRows.map((s) => `${s.label}-${s.qty}`).join('、') }}
                  </template>
                </td>
              </tr>

              <!-- 明细表头：序号|名字|号码|尺码|数量|备注 | 订单状态 | 二维码(右) -->
              <tr>
                <th class="cell lbl" colspan="1">序号</th>
                <th class="cell lbl" colspan="1">名字</th>
                <th class="cell lbl" colspan="1">号码</th>
                <th class="cell lbl" colspan="1">尺码</th>
                <th class="cell lbl" colspan="1">数量</th>
                <th class="cell lbl" colspan="1">备注</th>
                <th class="cell lbl" colspan="2">订单状态</th>

                <!-- 二维码：紧贴订单状态右边，向下合并 表头 + 3 个状态行 = 4 行。
                 支持多张图（qrCode 字段用 || 等分隔），用 CSS Grid 让图块撑满整个净空。 -->
                <td class="cell qr-cell" colspan="4" rowspan="4">
                  <div
                    v-if="qrCodes.length > 0"
                    class="qr-imgs"
                    :class="{
                      'is-single': qrCodes.length === 1,
                      'is-multi': qrCodes.length > 1,
                    }"
                  >
                    <img
                      v-for="(src, idx) in qrCodes"
                      :key="idx"
                      :src="src"
                      :style="qrItemSize"
                      class="qr-img"
                      :alt="`订单二维码 ${idx + 1}`"
                    />
                  </div>
                </td>
              </tr>

              <!-- 明细数据行 -->
              <tr v-for="i in rowIndexes" :key="i">
                <td class="cell val" colspan="1">{{ i + 1 }}</td>
                <td class="cell val" colspan="1">
                  {{ personList[i]?.name ?? '' }}
                </td>
                <td class="cell val" colspan="1">
                  {{ personList[i]?.number ?? '' }}
                </td>
                <td class="cell val" colspan="1">
                  {{ personList[i]?.size ?? '' }}
                </td>
                <td class="cell val" colspan="1">
                  {{ orderDetails[i]?.setQuantity ?? '' }}
                </td>
                <td class="cell val" colspan="1">
                  {{ personList[i]?.remark ?? '' }}
                </td>

                <!-- 前 3 行：订单状态色块（二维码由表头行 rowspan 覆盖在右侧） -->
                <td
                  v-if="i < 3"
                  class="cell val status-cell"
                  colspan="2"
                  :class="statusCells[i]?.cls"
                  :style="statusCells[i]?.style"
                >
                  {{ statusCells[i]?.label ?? '' }}
                </td>

                <!-- 第 4 行(i===3)开始：款式图，向右下合并——跨订单状态列+二维码列，占满剩余所有行 -->
                <td
                  v-else-if="i === 3"
                  class="cell img-panel"
                  colspan="6"
                  :rowspan="rowCount - 3"
                >
                  <div class="product-imgs" :class="imageLayoutClass">
                    <img
                      v-for="(src, idx) in orderImages"
                      :key="idx"
                      :src="src"
                      class="product-img"
                      :class="{ 'is-only': orderImages.length <= IMG_GRID_GAP }"
                      :alt="`款式图 ${idx + 1}`"
                    />
                  </div>
                </td>
                <!-- i > 3 的行：右侧 6 列已被款式图 rowspan 覆盖，无需渲染 -->
              </tr>

              <!-- 底部：包装要求 / 地址 / 补水 -->
              <tr>
                <th class="cell lbl lbl-yellow lbl-tall" colspan="1">
                  包装要求
                </th>
                <td class="cell val val-area jls-emph-red" colspan="11">
                  {{ orderProcess?.packagingRequirements ?? '' }}
                </td>
              </tr>
              <tr>
                <th class="cell lbl lbl-yellow lbl-tall" colspan="1">地址</th>
                <td class="cell val val-area" colspan="11">
                  {{ orderDetail.shippingAddress ?? '' }}
                </td>
              </tr>
              <tr>
                <th class="cell lbl lbl-yellow lbl-tall" colspan="1">补水</th>
                <td class="cell val val-area" colspan="11">
                  {{ orderDetail.hydration ?? '' }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 打印信息 -->
          <div class="jls-meta">
            <span>打印人：{{ printerName }}</span>
            <span>打印时间：{{ printTime }}</span>
          </div>
        </div>
      </div>

      <Empty
        v-else
        class="py-12"
        :description="$t('common.noData')"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
      />
    </Spin>

    <!--
      用 #append-footer 而不是 #footer：vben 的 ModalDrawer 包装会把同名 slot
      当作 boolean prop `footer` 透传，触发 "Expected Boolean, got Function" warn。
      append-footer / center-footer / prepend-footer 不与任何 prop 同名，能正常走插槽。
      这里的 #append-footer 与抽屉自身的 cancel 按并存，所以无需手写取消按钮。

        打印：v-print 指令 → vue3-print-nb 自动 cloneNode(#orderPrintDiv) 进 iframe 打印。
      popTitle 决定 PDF 文件名；loading 状态由库 beforeOpenCallback / closeCallback 推动。
      printObj 同时通过 defineExpose 暴露给父组件，可通过 ref 直接打印。    -->
    <template #append-footer>
      <Button
        :disabled="!orderDetail || printing || exportingImage"
        :loading="exportingImage"
        @click="exportAsImage"
      >
        导出图片
      </Button>
      <Button
        type="primary"
        :disabled="!orderDetail || printing || exportingImage"
        :loading="printing"
        @click="onPrintClick"
        v-print="printObj"
      >
        {{ $t('common.print') }}
      </Button>
    </template>
  </ModalDrawer>
</template>

<style>
/*
 * 打印纸张：margin 设为 0 会让 Chrome 把"页眉页脚"那个选项直接
 * 从打印对话框里隐藏掉（URL、标题、日期、页码都不会出现在 PDF 上）。
 * 视觉边距由 .jls-print 自身的 padding 控制——下面 @media print 那条
 * 规则把屏幕端的 12px 拉到 ~12mm，保证内容不会被裁到纸张边沿。
 */
@page {
  size: A4 portrait;
  margin: 0;
}

/* ---------- 容器 ----------
 * max-width 必须与 use-order-print.ts 的容器宽（700px）对齐。
 * 否则两边的 <img>.clientWidth 不一样，calcImageGridHeight() 算出的
 * rowspan 会漂移，预览/导出图"行数不一样"。
 * 早前这里写的是 900px，与导出口径不一致——已改为 700px。
 */
#orderPrintDiv {
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  /* 屏幕端 padding 适配 drawer 预览；纸张端由下面 @media print 拉到 ~12mm */
  padding: 12px;
  color: #000;
  font-size: 12px;
  line-height: 1.4;
  box-sizing: border-box;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

#orderPrintDiv,
#orderPrintDiv * {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  box-sizing: border-box;
}

/*
 * 表格边框（屏幕端）：border-collapse: separate + outline 补外层。
 *
 * separate 用于屏幕端：保证屏幕预览正常，格子边框独立画，不受 collapse
 * colspan/rowspan 冲突规则影响（屏幕端用的是 ::after box-shadow 方案）。
 *
 * 打印端（extraHead / @media print）：改用 border-collapse: collapse，
 * 合并边框，无缝隙，所有边等粗（1px），是真正的"无线"效果。
 */
#orderPrintDiv table.jls-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  page-break-inside: auto;
  outline: 1px solid #2f6fb5; /* 补齐外层边框，视觉与内部 border 同粗 */
}

#orderPrintDiv td,
#orderPrintDiv th {
  border: 1px solid #2f6fb5;
  padding: 1.5pt 4pt;
  min-height: 18pt;
  vertical-align: middle;
  word-break: break-all;
  text-align: center;
}

/* ::after box-shadow 边框方案已移除（改为直接 border，更稳定） */

/* 标题：与其他单元一致带上边框 */
#orderPrintDiv .title-cell {
  font-size: 18px;
  padding: 4px 0 10px;
}

/* ---------- 标签底色 ---------- */
#orderPrintDiv .lbl {
  background: #c9d9ef;
  font-weight: 600;
  white-space: nowrap;
}

#orderPrintDiv .lbl-orange {
  background: #f6c9a3;
}

#orderPrintDiv .lbl-yellow {
  background: #ffff66;
}

#orderPrintDiv .lbl-tall {
  height: 40px;
}

/* ---------- 值样式 ---------- */
#orderPrintDiv .val-red {
  color: #d40000;
  font-weight: 600;
}

#orderPrintDiv .val-fabric {
  background: #ffff00;
  font-weight: 700;
}

#orderPrintDiv .val-area {
  text-align: left;
  vertical-align: middle;
  white-space: pre-wrap;
  word-break: break-all;
}

#orderPrintDiv .val-total {
  font-weight: 700;
  background: #f2f2f2;
}

/* ---------- 订单状态色块 ---------- */
#orderPrintDiv .status-cell {
  font-weight: 700;
}

/* 字体颜色由内联 style 控制（取字典 colorType 映射），
   这里只覆盖历史 .status-normal 的背景色，避免绿底白字遮住字典色。 */
#orderPrintDiv .status-normal {
  background: transparent;
}

/* 绿底黑字（正常状态 orderStatus === 3） */
#orderPrintDiv .status-green {
  background: #52c41a;
  color: #000;
  font-weight: 700;
}

/* 红底黑字（非正常状态） */
#orderPrintDiv .status-red {
  background: #ff4d4f;
  color: #000;
  font-weight: 700;
}

#orderPrintDiv .status-mid {
  background: #ffff00;
  color: #000;
}

#orderPrintDiv .status-neck {
  color: #d40000;
  background: #eef3fb;
}

/* ---------- 二维码 ---------- */
/* qr-cell 是 td：水平居中、垂直居中，padding 0 让净空留给图块。
 * 给一个明确的 height，让内层 .qr-imgs 用 height:100% 时真的能拿到 96px。 */
#orderPrintDiv .qr-cell {
  vertical-align: middle;
  padding: 0;
  height: 96px; /* rowspan=4 × 24px */
}

/* 二维码容器：flex 单行排列，所有图水平垂直居中。
 * 关键：每张 <img> 上有 inline style 写死 px 宽高（见 qrItemSize），
 * 容器只负责排列+间距，不再依赖 aspect-ratio / max-height 百分比这种
 * iframe 打印渲染不稳定的 CSS。 */
#orderPrintDiv .qr-imgs {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

/* qr-img 兜底样式：尺寸由 inline style 控制；这里只设对齐+背景。
 * 不要写 width/height/aspect-ratio，避免覆盖 inline style。 */
#orderPrintDiv .qr-img {
  display: block;
  margin: 0 auto;
  object-fit: contain;
  background: #fff;
  flex-shrink: 0; /* 多张时绝不被 flex 压缩到极小 */
}

/* ---------- 款式图 ---------- */
/*
 * Issue 3：图片宽高跟着容器自适应，不再写死 160px。
 *
 *   - td.img-panel 的高度由 rowspan 决定（行数 × 24px），
 *     宽度由 colspan 决定（约容器宽 × 5/12）。
 *   - .product-imgs 填满 td；grid item 用 1fr 平均分。
 *   - .product-img 直接 width:100% height:100% + object-fit:contain，
 *     这样不管原图比例是横、竖、还是方，都会被等比缩放进格子里，
 *     不会出现"有时太大、有时太小"的问题。
 */
#orderPrintDiv .img-panel {
  vertical-align: top;
  padding: 8px;
  page-break-inside: avoid;
}

/*
 * 款式图容器 grid 布局：
 *   - is-single（≤IMG_GRID_GAP 张）：单列纵向排列，每张图占满整列宽度
 *   - is-multi（>IMG_GRID_GAP 张）：两列网格，行数按 ceil(n/2) 计算
 * html-to-image 走 SVG foreignObject，由浏览器原生渲染，grid / flex / rowspan 都正常。
 */
#orderPrintDiv .product-imgs.is-single {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: auto;
  align-items: stretch;
}

#orderPrintDiv .product-imgs.is-multi {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  /* min-content：每行高度 = 该行最高图片的内容高度（不再拉伸到填满容器） */
  grid-auto-rows: min-content;
  align-items: stretch;
  justify-items: stretch;
  gap: 8px;
  width: 100%;
  height: auto;
}

#orderPrintDiv .product-img {
  display: block;
  /* 宽度按 IMG_SCALE 缩 5%，水平居中——打印版面图片整体小一圈。
   * 同时把 width 显式写出来，避免浏览器对 95% 类型的"非标准百分比"
   * 在某些 layout 阶段把它回退到 100%。配合 max-width: 100% 兜底，
   * 保证图片不会突破父格子。 */
  width: calc(100% * 0.95);
  max-width: 100%;
  margin: 0 auto;
  height: auto;
  object-fit: contain;
  background: #fff;
  min-height: 0;
}

/* 单列模式下每张图同样按 IMG_SCALE 占整列宽度，水平居中 */
#orderPrintDiv .product-imgs.is-single .product-img {
  width: calc(100% * 0.95);
  max-width: 100%;
  margin: 0 auto;
}

/* ---------- 打印信息 ---------- */
#orderPrintDiv .jls-meta {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  font-size: 12px;
}

/*
 * 打印到纸张时的视觉边距：
 *  @page { margin: 0 } 让 Chrome 把"页眉/页脚/URL/页码"那一栏从打印框里干掉，
 *  但如果容器自身没有 padding，内容就会贴到纸张边沿、看上去像被裁掉了。
 *  这里给 #orderPrintDiv 一个 ~12mm 的内边距，让内容距离纸张物理边缘
 *  有足够的呼吸空间，看起来像一份正常的 A4 制单。
 *  屏幕端 preview 仍按 12px（上面那条规则）走，不影响 drawer 显示。
 */
@media print {
  /* 纸张上撑满 A4 可用区（屏幕端 max-width 在非 print 块里设） */
  #orderPrintDiv {
    max-width: none;
    padding: 12mm;
  }

  /* 打印时：统一用 collapse，所有边框交给 cell */
  #orderPrintDiv table.jls-table {
    border-collapse: collapse !important;
    border: none !important;
    outline: none !important;
  }

  #orderPrintDiv table.jls-table td,
  #orderPrintDiv table.jls-table th {
    border: 1px solid #2f6fb5 !important;
  }

  /* 消除 iframe/body/html 默认缝隙 */
  body,
  html {
    margin: 0 !important;
    padding: 0 !important;
  }
}

/* ---------- 尺码统计：红色加粗 ---------- */
#orderPrintDiv .jls-stat-text {
  color: #d40000;
  font-weight: 700;
}

/* ---------- 车间要求 / 包装要求：红色加粗加大 ---------- */
#orderPrintDiv .jls-emph-red {
  color: #d40000;
  font-weight: 700;
}
</style>
