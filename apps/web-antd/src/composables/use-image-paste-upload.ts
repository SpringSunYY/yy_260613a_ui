import type { FileType } from 'ant-design-vue/es/upload/interface';

import type { Ref } from 'vue';

import { ref } from 'vue';

import { message, Upload } from 'ant-design-vue';

/**
 * 把标准 File 适配成 antd 的 FileType（antd 在原生 File 基础上多塞了 uid/lastModifiedDate）。
 */
function toFileType(file: File): FileType {
  return file as unknown as FileType;
}

/**
 * 单张图片"粘贴上传"逻辑。
 *
 * <p>使用场景：页面里已经有一个原生的 Upload.Dragger 作为主入口，
 * 但用户更习惯直接 Ctrl+V 粘贴图片。本组合只负责：
 * <ul>
 *   <li>拦截 paste 事件，从剪贴板 items 中拿到 image file</li>
 *   <li>模拟 beforeUpload 行为：替换 queryFile、用 FileReader 预览</li>
 *   <li>用户输入任意字符时立即清空（防止误输入文字）</li>
 *   <li>点击容器时主动 focus 到内部 input，让光标可见</li>
 * </ul>
 *
 * <p>默认是"单张"模式：粘贴新图会直接覆盖旧图。
 * 适用于本仓库 search-modal / search/index.vue 这种以图搜图场景。
 */
export function useImagePasteUpload(options: {
  /** 图片格式校验，true 表示通过 */
  acceptImage?: (file: File) => boolean;
  /** 校验失败时的提示（i18n key 已经传过来的字符串） */
  errorHint?: string;
  /**
   * 拿到粘贴上来的 File 之后的副作用：
   * 调用方一般在这里：
   *   - 把 file 赋给 queryFile
   *   - 清旧结果
   *   - 用 FileReader 生成预览 URL
   */
  onFile: (file: FileType) => void;
}) {
  const { onFile, acceptImage, errorHint } = options;

  const pasteInputRef = ref<HTMLInputElement | null>(null);
  const pasteInputValue = ref<string>('');

  /** 阻止冒泡到外层 Upload.Dragger，避免误触发"点击上传" */
  function focusPasteTarget(event: MouseEvent) {
    event.stopPropagation();
    pasteInputRef.value?.focus();
  }

  /** 用户键入任何字符都立即清空（不让编辑文字） */
  function onPasteInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.value !== '') {
      target.value = '';
      pasteInputValue.value = '';
    }
  }

  /** 真正从 paste 事件里挑 image item，转成 File 后回传 */
  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    const items = event.clipboardData?.items;
    if (!items || items.length === 0) {
      return;
    }
    const list = [...items];
    for (const item of list) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (!file) continue;
      if (!file.type.startsWith('image/')) {
        if (errorHint) message.error(errorHint);
        return Upload.LIST_IGNORE;
      }
      if (acceptImage && !acceptImage(file)) {
        if (errorHint) message.error(errorHint);
        return Upload.LIST_IGNORE;
      }
      onFile(toFileType(file));
      return;
    }
  }

  return {
    pasteInputRef,
    pasteInputValue,
    focusPasteTarget,
    onPasteInputChange,
    handlePaste,
  };
}

/**
 * 组合式工具：单张预览的 FileReader。
 *
 * <p>和 useImagePasteUpload 配合用：粘贴拿到 File 后，调 previewFileAsDataURL
 * 拿到 data URL 赋给 img src。
 */
export function previewFileAsDataURL(
  file: File,
  onLoaded: (dataUrl: string) => void,
) {
  const reader = new FileReader();
  reader.addEventListener('load', (e) => {
    onLoaded((e.target?.result as string) ?? '');
  });
  reader.readAsDataURL(file);
}

/**
 * 标记一个 Ref&lt;FileType | null&gt; 已绑定到 paste 上传。
 * 仅为类型辅助，无运行时副作用。
 */
export type QueryFileRef = Ref<FileType | null>;
