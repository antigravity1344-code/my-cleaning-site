import React, { useContext, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { BackgroundInertContext } from '../context/BackgroundInertContext';

interface PageModalProps {
  /** همان کاری که دکمه‌ی بستن انجام می‌دهد؛ Escape هم همین را صدا می‌زند. */
  onClose: () => void;
  /** id عنوانی (داخل children) که نام پنجره است. */
  labelledBy: string;
  /** کلاس‌های لایه‌ی تیره‌ی پشت پنجره. */
  overlayClassName: string;
  /** کلاس‌های خود پنجره (کارت سفید). */
  panelClassName: string;
  children: React.ReactNode;
}

/**
 * پنجره‌ی مودالِ داخل بخش‌های صفحه، با همان رفتار دسترس‌پذیر پنجره‌های اصلی:
 *   • role="dialog" و aria-modal با نام از عنوان،
 *   • فوکوس داخل پنجره، چرخش Tab، بستن با Escape و بازگشت فوکوس (useDialogA11y)،
 *   • تا وقتی باز است، پس‌زمینه‌ی صفحه inert است (از طریق App).
 *
 * چون این بخش‌ها خودشان داخل پس‌زمینه‌ی inert‌شونده هستند، پنجره با portal در
 * document.body رندر می‌شود تا خودش هرگز زیر عنصر inert قرار نگیرد. این کامپوننت فقط
 * وقتی پنجره باز است mount می‌شود.
 */
export function PageModal({ onClose, labelledBy, overlayClassName, panelClassName, children }: PageModalProps) {
  // هوک، دکمه‌ی بازکننده را در layout effect ثبت و فوکوس را به پنجره منتقل می‌کند.
  // اعلام باز بودن به App (setState) پس از همه‌ی layout effectها اعمال می‌شود، پس
  // پس‌زمینه بعد از ثبت بازکننده inert می‌شود؛ ترتیب این دو فراخوانی اهمیتی ندارد.
  const dialogRef = useDialogA11y(true, onClose);
  const holdBackgroundInert = useContext(BackgroundInertContext);
  useLayoutEffect(() => holdBackgroundInert(), [holdBackgroundInert]);

  return createPortal(
    <div className={overlayClassName}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`${panelClassName} outline-none`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
