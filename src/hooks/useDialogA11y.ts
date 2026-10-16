import { useLayoutEffect, useRef } from 'react';

/**
 * رفتار دسترس‌پذیر برای پنجره‌های مودال (الگوی dialog در WAI-ARIA):
 *   • با باز شدن، فوکوس صفحه‌کلید به خود پنجره منتقل می‌شود (صفحه‌خوان عنوان را می‌خواند)،
 *   • Tab و Shift+Tab داخل پنجره می‌چرخند و به صفحه پشت آن نمی‌روند،
 *   • کلید Escape پنجره را می‌بندد (همان کار دکمه «بستن»)،
 *   • با بسته شدن، فوکوس به دکمه‌ای که پنجره را باز کرده بود برمی‌گردد.
 *
 * پنهان‌کردن صفحه‌ی پشت پنجره از صفحه‌خوان و تعامل (`inert`) در App انجام می‌شود،
 * نه اینجا؛ چون App می‌داند «آیا پنجره‌ای باز است» و در انتقال از یک پنجره به
 * پنجره‌ی دیگر، پس‌زمینه حتی یک لحظه هم فعال نمی‌شود.
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

/**
 * عنصری که باید پس از بسته شدن پنجره‌ی قبلی فوکوس بگیرد، اما هنوز نمی‌تواند
 * (مثلاً چون در انتقال «مشاور ← فرم رزرو» پس‌زمینه هنوز inert است). پنجره‌ی
 * بعدی آن را به‌عنوان مقصد بازگشت فوکوس خودش برمی‌دارد.
 */
let pendingReturnFocus: HTMLElement | null = null;

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

function isOpenModalDialogPresent(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
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

  // useLayoutEffect (نه useEffect): مقصد بازگشت فوکوس باید در همان commit و پیش از
  // به‌روزرسانی بعدی مرورگر خوانده شود؛ پس از آن، مرورگر فوکوسِ عنصرِ inert‌شده
  // (دکمه‌ی بازکننده در پس‌زمینه) را به body منتقل می‌کند.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const active = document.activeElement;
    const returnFocusTo =
      active instanceof HTMLElement && active !== document.body && !dialog.contains(active)
        ? active
        : pendingReturnFocus;
    pendingReturnFocus = null;

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
      const current = document.activeElement;
      const focusIsInside = current instanceof Node && dialog.contains(current);

      if (event.shiftKey) {
        if (!focusIsInside || current === dialog || current === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!focusIsInside || current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // محافظ دوم: اگر فوکوس به هر طریقی به صفحه‌ی پشت پنجره برود، به خود پنجره
    // برگردانده می‌شود.
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

      if (!returnFocusTo || !returnFocusTo.isConnected) return;
      returnFocusTo.focus();
      if (document.activeElement === returnFocusTo) return;

      // فوکوس نگرفت؛ یعنی پس‌زمینه هنوز inert است. یا پنجره‌ی دیگری در همین
      // لحظه باز می‌شود (که این مقصد را برمی‌دارد)، یا inert در ادامه‌ی همین
      // commit برداشته می‌شود؛ پس یک بار پس از پایان commit دوباره تلاش می‌شود.
      pendingReturnFocus = returnFocusTo;
      queueMicrotask(() => {
        if (pendingReturnFocus !== returnFocusTo) return;
        if (isOpenModalDialogPresent()) return;
        pendingReturnFocus = null;
        if (returnFocusTo.isConnected) returnFocusTo.focus();
      });
    };
  }, [isOpen]);

  return dialogRef;
}
