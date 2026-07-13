<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { OrderApi } from '#/api/erp/order';
import type { OrderProcessApi } from '#/api/erp/orderProcess';

import { computed, nextTick, ref, watch } from 'vue';

import { useVbenModelDrawer } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';
import { formatDate } from '@vben/utils';

import { Button, Empty, Spin } from 'ant-design-vue';

import { getOrderDetailNo, printOrder } from '#/api/erp/order';
import { $t } from '#/locales';
import { DICT_TYPE, getDictLabel, getDictOptions } from '#/utils';

const emit = defineEmits(['success']);

const userStore = useUserStore();

const orderTitle = ref('');
const orderDetail = ref<OrderApi.Order>();
const orderProcess = ref<OrderProcessApi.OrderProcess>();
const orderDetails = ref<OrderApi.OrderDetail[]>([]);
const loading = ref(false);
const printTime = ref(formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss'));
const printing = ref(false);

/** 明细表最少渲染行数（不足补空行，贴近纸质单据样式） */
const MIN_ROWS = 20;

/**
 * 打印纸张内 #orderPrintDiv 容器的有效宽度（px）。
 *
 * Issue 4 需要根据款式图总高度算出"明细区要补多少行"，而这个高度依赖容器宽。
 * 屏幕端 drawer 和 iframe 端都共用同一份全局 CSS（max-width: 700px; padding: 12px），
 * 所以这里直接用固定值，避免布局抖动时重复计算。
 */
const PRINT_INNER_WIDTH = 700 - 24; // 700 - 2 * 12 padding
/** 主表共 12 等分列；款式图列 colspan = 5 */
const IMG_PANEL_COLSPAN = 5;
const IMG_PANEL_TOTAL_COLS = 12;
/** 款式图列内部 padding + 2 列网格 gap */
const IMG_PANEL_INNER_PAD = 16; // 8 + 8
const IMG_GRID_GAP = 8;
/** 明细行单元高度（与 .cell { height: 24px } 一致，用于把"像素"转成"行" */
const TABLE_ROW_PX = 24;
/** 款式图列里"状态行"占的 3 行（前 3 行是状态色块，第 4 行起才是图） */
const STATUS_ROWS_BEFORE_IMG = 3;

/** 尺码字典（把 setSize 翻译成 label 并按自然序排序） */
const sizeOptions = getDictOptions(DICT_TYPE.ERP_SET_SIZE, 'string');
const sizeSortList = sizeOptions
  .map((opt) => ({ value: String(opt.value), label: opt.label }))
  .sort((a, b) =>
    a.label.localeCompare(b.label, 'zh-Hans-CN', { numeric: true }),
  );

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
    #orderPrintDiv {
      font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 12px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
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
    #orderPrintDiv .jls-print {
      max-width: 700px;
      margin: 0 auto;
      padding: 12px;
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

function startTitleGuard(targetTitle: string) {
  // 已经有遗留的 guard 就先清掉，避免叠加
  titleGuardCleanup?.();

  const originalTitle = document.title;
  document.title = targetTitle;

  // MutationObserver：Vue Router 或别的代码可能会改 document.title，
  // 一旦发现被改就立刻再写一次 target。
  const observer = new MutationObserver(() => {
    if (document.title !== targetTitle) {
      document.title = targetTitle;
    }
  });
  observer.observe(document.querySelector('title') ?? document.head, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  // beforeprint：兜底某些浏览器同步读 title 的场景。
  const onBeforePrint = () => {
    if (document.title !== targetTitle) document.title = targetTitle;
  };
  // afterprint：浏览器读完 title 后再还原。
  const onAfterPrint = () => {
    document.title = originalTitle;
  };
  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', onAfterPrint);

  titleGuardCleanup = () => {
    observer.disconnect();
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', onAfterPrint);
    // 3 秒后强制还原（Chrome 异步读 title 大概就是几百 ms，留点余量）
    window.setTimeout(() => {
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
    beforeOpenCallback() {
      printing.value = true;
      // 在库 createPrintWindow() 之后找出 DOM 里最新出现的 printArea_ iframe 缓存下来
      const iframes = document.querySelectorAll<HTMLIFrameElement>(
        'iframe[id^="printArea_"]',
      );
      currentPrintIframe = iframes[iframes.length - 1] ?? null;
    },
    openCallback() {
      const title =
        orderTitle.value || `JLS制单-${orderDetail.value?.orderNo ?? ''}`;
      // Firefox：同步读 iframe 自己的 title
      const doc = currentPrintIframe?.contentDocument;
      if (doc) doc.title = title;
      // Chromium：异步读主窗口的 title，用 guard 守住
      startTitleGuard(title);
      // 去更新订单打印
      printOrder(orderDetail.value?.orderNo!).then((res) => {
        emit('success');
      });
    },
    closeCallback() {
      currentPrintIframe = null;
      printing.value = false;
    },
  };
});

/** 暴露给父组件 */
defineExpose({ printObj });

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
 *  - 未加载完成的图（naturalWidth === 0）按 1:1 兜底，
 *    不会阻塞主流程，也不会让整个页面卡顿（用户上一轮反馈）。
 *  - 监听 orderImages 变化 → 在 DOM 更新完成 (flush: 'post') 后再算。
 */
const productImgsHeightPx = ref(0);

/**
 * 读 DOM 里 <img> 的真实宽高比，再按 2 列网格算出图片区总像素高。
 * 函数本身纯计算，无副作用——可以多次调用、配合 watch 增量触发。
 */
function calcImageGridHeight(imgs: string[]): number {
  const sourceEl = document.querySelector('#orderPrintDiv');
  const domImgs: HTMLImageElement[] = sourceEl
    ? ([...sourceEl.querySelectorAll('img.product-img')] as HTMLImageElement[])
    : [];

  // 款式图列宽度 = 容器宽 × (colspan/totalCols)，再扣 td 内 padding
  const panelWidth =
    (PRINT_INNER_WIDTH * IMG_PANEL_COLSPAN) / IMG_PANEL_TOTAL_COLS;
  const usableWidth = panelWidth - IMG_PANEL_INNER_PAD;

  const isSingle = imgs.length === 1;
  // 单张图占满整列；多张图走 2 列网格，列宽 = (可用宽 - gap) / 2
  const cellWidth = isSingle
    ? usableWidth
    : Math.max(1, (usableWidth - IMG_GRID_GAP) / 2);

  // 模拟 2 列网格行高累计：每行两列里取较高那张，作为该行行高
  let totalPx = 0;
  let rowMaxPx = 0;
  for (let i = 0; i < imgs.length; i++) {
    const col = i % 2; // 0 / 1
    const dom = domImgs[i];
    const w = dom?.naturalWidth ?? 0;
    const h = dom?.naturalHeight ?? 0;
    const aspect = w > 0 && h > 0 ? w / h : 1; // 未加载完的图按 1:1 兜底
    const cellH = cellWidth / aspect;

    if (col === 0) {
      // 进入新一行：上一行先收尾
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
 * 等 DOM 提交、<img> 元素已经在节点树里之后，
 * 再从 naturalWidth/Height 算一次图片区高度。
 * 关闭弹窗 / 切换订单 → watch 重新触发；首次进来 → nextTick 也覆盖到。
 */
function recomputeImgsHeight() {
  const imgs = orderImages.value;
  productImgsHeightPx.value = imgs.length === 0 ? 0 : calcImageGridHeight(imgs);
}

watch(
  orderImages,
  () => {
    // DOM 已 patch、img 元素已挂上 → 再计算。
    void nextTick(() => recomputeImgsHeight());
  },
  { immediate: true },
);

/** 二维码图（qrCode 仅一张） */
const qrCode = computed<string>(() =>
  String((orderDetail.value as any)?.qrCode ?? '').trim(),
);

/** 明细人员列表（名字/号码/尺码/备注） */
const personList = computed(() =>
  orderDetails.value.map((row) => ({
    name: (row as any).name ?? '',
    number: row.setNumber ?? '',
    size: dictLabel(DICT_TYPE.ERP_SET_SIZE, row.setSize),
    remark: (row as any).remark ?? '',
  })),
);

/** 尺码 => 数量 汇总 */
const sizeSummary = computed(() => {
  const totals = new Map<string, number>();
  for (const row of orderDetails.value) {
    const size = row.setSize;
    const qty = Number(row.setQuantity) || 0;
    if (size === undefined || size === null || size === '' || qty <= 0)
      continue;
    const key = String(size);
    totals.set(key, (totals.get(key) ?? 0) + qty);
  }
  return sizeSortList
    .filter((s) => totals.has(s.value))
    .map((s) => ({ label: s.label, qty: totals.get(s.value)! }));
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
const statusCells = computed(() => [
  {
    label: dictLabel(
      DICT_TYPE.ERP_ORDER_STATUS,
      orderDetail.value?.orderStatus,
    ),
    cls: 'status-normal',
  },
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
  const base = Math.max(
    personList.value.length,
    sizeRows.value.length,
    MIN_ROWS,
  );
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
    orderTitle.value = `JLS制单-${orderDetail.value?.orderNo}-${dictLabel(
      DICT_TYPE.ERP_ORDER_PICKUP_METHOD,
      orderDetail.value?.pickupMethod,
    )}`;
    printTime.value = formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss');
  } finally {
    loading.value = false;
  }
}

const [ModalDrawer, modalDrawerApi] = useVbenModelDrawer({
  async onConfirm() {
    await modalDrawerApi.close();
    emit('success');
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      orderDetail.value = undefined;
      orderProcess.value = undefined;
      orderDetails.value = [];
      return;
    }
    const data = modalDrawerApi.getData<OrderApi.Order>();
    if (!data || !data.orderNo) return;
    modalDrawerApi.lock();
    try {
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
                <th class="cell title-cell" colspan="12">
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
                  {{ orderDetail.customer ?? '' }}
                </td>
                <td class="cell val val-red" colspan="1">
                  {{ orderDetail.number ?? '' }}
                </td>
                <td class="cell val val-red" colspan="2">
                  {{ formatDateValue(orderDetail.orderTime) }}
                </td>
                <td class="cell val val-red" colspan="2">
                  {{ formatDateValue(orderDetail.shippingTime) }}
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
                <td class="cell val val-area" colspan="11">
                  {{ orderProcess?.workshopRequirements ?? '' }}
                </td>
              </tr>

              <!-- 明细表头：序号|名字|号码|尺码|备注 | 尺码|数量 | 订单状态 | 二维码(右) -->
              <tr>
                <th class="cell lbl" colspan="1">序号</th>
                <th class="cell lbl" colspan="1">名字</th>
                <th class="cell lbl" colspan="1">号码</th>
                <th class="cell lbl" colspan="1">尺码</th>
                <th class="cell lbl" colspan="1">备注</th>
                <th class="cell lbl" colspan="1">尺码</th>
                <th class="cell lbl" colspan="1">数量</th>
                <th class="cell lbl" colspan="2">订单状态</th>

                <!-- 二维码：紧贴订单状态右边，向下合并 表头 + 3 个状态行 = 4 行 -->
                <td class="cell qr-cell" colspan="3" rowspan="4">
                  <img
                    v-if="qrCode"
                    :src="qrCode"
                    class="qr-img"
                    alt="订单二维码"
                  />
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
                  {{ personList[i]?.remark ?? '' }}
                </td>

                <!-- 尺码汇总列 -->
                <td
                  class="cell val"
                  colspan="1"
                  :class="{ 'val-total': sizeRows[i]?.isTotal }"
                >
                  {{ sizeRows[i]?.label ?? '' }}
                </td>
                <td
                  class="cell val"
                  colspan="1"
                  :class="{ 'val-total': sizeRows[i]?.isTotal }"
                >
                  {{ sizeRows[i] ? sizeRows[i].qty : '' }}
                </td>

                <!-- 前 3 行：订单状态色块（二维码由表头行 rowspan 覆盖在右侧） -->
                <td
                  v-if="i < 3"
                  class="cell val status-cell"
                  colspan="2"
                  :class="statusCells[i]?.cls"
                >
                  {{ statusCells[i]?.label ?? '' }}
                </td>

                <!-- 第 4 行(i===3)开始：款式图，向右下合并——跨订单状态列+二维码列，占满剩余所有行 -->
                <td
                  v-else-if="i === 3"
                  class="cell img-panel"
                  colspan="5"
                  :rowspan="rowCount - 3"
                  :style="{ height: `${(rowCount - 3) * TABLE_ROW_PX}px` }"
                >
                  <div
                    class="product-imgs"
                    :class="{ 'is-single': orderImages.length === 1 }"
                  >
                    <img
                      v-for="(src, idx) in orderImages"
                      :key="idx"
                      :src="src"
                      class="product-img"
                      :alt="`款式图 ${idx + 1}`"
                    />
                  </div>
                </td>
                <!-- i > 3 的行：右侧 5 列已被款式图 rowspan 覆盖，无需渲染 -->
              </tr>

              <!-- 底部：包装要求 / 地址 / 补水 -->
              <tr>
                <th class="cell lbl lbl-yellow lbl-tall" colspan="1">
                  包装要求
                </th>
                <td class="cell val val-area" colspan="11">
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
      这里的 #append-footer 与抽屉自身的 cancel 按��并存，所以无需手写取消按钮。

        打印：v-print 指令 → vue3-print-nb 自动 cloneNode(#orderPrintDiv) 进 iframe 打印。
      popTitle 决定 PDF 文件名；loading 状态由库 beforeOpenCallback / closeCallback 推动。
      printObj 同时通过 defineExpose 暴露给父组件，可通过 ref 直接打印。    -->
    <template #append-footer>
      <Button
        type="primary"
        :disabled="!orderDetail || printing"
        :loading="printing"
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

/* ---------- 容器 ---------- */
#orderPrintDiv {
  width: 100%;
  max-width: 900px;
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
}

#orderPrintDiv .val-total {
  font-weight: 700;
  background: #f2f2f2;
}

/* ---------- 订单状态色块 ---------- */
#orderPrintDiv .status-cell {
  font-weight: 700;
}

#orderPrintDiv .status-normal {
  background: #37a24a;
  color: #fff;
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
#orderPrintDiv .qr-cell {
  vertical-align: middle;
  padding: 3px;
}

#orderPrintDiv .qr-img {
  display: block;
  margin: 0 auto;
  width: 100px;
  height: 100px;
  object-fit: contain;
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
  /* 不写 height：td 由 rowspan 自动拉到 N 行高，
     .product-imgs 在 td 内 100% 填充即可 */
}

#orderPrintDiv .product-imgs {
  display: grid;
  gap: 8px;
  width: 100%;
  height: 100%;
  align-items: stretch;
  justify-items: stretch;
}

#orderPrintDiv .product-imgs,
#orderPrintDiv .product-imgs:not(.is-single) {
  /* 默认两列（多张图时一行两张） */
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* 单张图：一列、占满整行（"一行一张"） */
#orderPrintDiv .product-imgs.is-single {
  grid-template-columns: minmax(0, 1fr);
}

#orderPrintDiv .product-img {
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
  background: #fff;
}

/* ---------- 打印信息 ---------- */
#orderPrintDiv .jls-meta {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 8px;
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
</style>
