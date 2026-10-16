import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * رفتار دسترس‌پذیر برای پنجره‌های مودال (الگوی dialog در WAI-ARIA):
 *   • با باز شدن، فوکوس صفحه‌کلید به خود پنجره منتقل می‌شود (صفحه‌خوان عنوان را می‌خواند)،
 *   • Tab و Shift+Tab داخل پنجره می‌چرخند و به صفحه پشت آن نمی‌روند،
 *   • کلید Escape پنجره را می‌بندد (همان کار دکمه «بستن»)،
 *   • با بسته شدن، فوکوس به دکمه‌ای که پنجره را باز کرده بود برمی‌گردد.
 *
 * ref برگشتی باید روی عنصری قرار بگیرد که `role="dialog"`، `aria-modal="true"`
 * و `tabIndex={-1}` دارد. این هوک باید پیش از هر `return null` زودهنگام
 * فراخوانی شود تا ترتیب هوک‌ها ثابت بماند.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]',
].join(',');

function getTabbableElements(dialog: HTMLElement): HTMLElement[] {
  // در jsdom (آزمون‌ها) چیدمان وجود ندارد؛ فقط وقتی مرورگر واقعاً چیدمان دارد،
  // عناصر پنهان‌شده با CSS (مثلاً display:none) کنار گذاشته می‌شوند.
  const hasLayout = dialog.getClientRects().length > 0;

  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.tabIndex < 0) return false;
    if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    if (hasLayout && element.getClientRects().length === 0) return false;
    return true;
  });
}

export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const dialogRef = useRef<T | null>(null);

  // همیشه آخرین onClose استفاده شود، بدون اینکه شنونده‌ها با هر رندر دوباره ثبت شوند.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;

    if (!dialog.contains(document.activeElement)) {
      dialog.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const tabbable = getTabbableElements(dialog);
      if (tabbable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = tabbable[0];
      const last = tabbable[tabbable.length - 1];
      const active = document.activeElement;
      const focusIsInside = active instanceof Node && dialog.contains(active);

      if (event.shiftKey) {
        if (!focusIsInside || active === dialog || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!focusIsInside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // محافظ دوم: اگر فوکوس به هر طریقی (مثلاً با کلیک یا مکان‌نمای صفحه‌خوان) به
    // صفحه‌ی پشت پنجره برود، به خود پنجره برگردانده می‌شود.
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && !dialog.contains(target)) {
        dialog.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  return dialogRef;
}
