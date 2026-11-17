import { useState } from 'react';
import { buildDedicatedTrackUrl, usableTrackingCode } from './trackingLink';

interface OrderTrackingShareProps {
  trackingCode: string | null | undefined;
}

/**
 * نمایش کد رهگیری و لینک اختصاصی پیگیری برای ارسال به مشتری از پنل مدیر.
 */
export function OrderTrackingShare({ trackingCode }: OrderTrackingShareProps) {
  const code = usableTrackingCode(trackingCode);
  const trackUrl = buildDedicatedTrackUrl(code);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopyLink = async () => {
    setCopyError(false);
    if (!trackUrl) {
      setCopyError(true);
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) {
        setCopyError(true);
        return;
      }
      await navigator.clipboard.writeText(trackUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  if (!code || !trackUrl) {
    return (
      <div className="admin-neutral rounded-2xl p-4 space-y-2">
        <h4 className="text-xs font-bold text-slate-700">پیگیری مشتری</h4>
        <p className="text-sm text-slate-600">
          کد رهگیری معتبر ORD برای این سفارش در دسترس نیست؛ لینک پیگیری ساخته نمی‌شود.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-neutral rounded-2xl p-4 space-y-3">
      <h4 className="text-xs font-bold text-slate-700">پیگیری مشتری</h4>
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-slate-500">کد رهگیری</dt>
        <dd className="font-mono text-slate-900 break-all" dir="ltr">
          {code}
        </dd>
        <dt className="text-slate-500">لینک اختصاصی پیگیری</dt>
        <dd className="break-all" dir="ltr">
          <a
            href={trackUrl}
            className="text-sm font-medium underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            {trackUrl}
          </a>
        </dd>
      </dl>
      <p className="text-xs text-slate-500">
        با باز کردن این لینک، کد رهگیری به‌صورت خودکار در صفحهٔ پیگیری قرار می‌گیرد و جست‌وجو انجام می‌شود.
      </p>
      <button type="button" onClick={() => void handleCopyLink()} className="admin-button">
        {copied ? 'لینک کپی شد' : 'کپی لینک پیگیری'}
      </button>
      {copyError ? (
        <p role="alert" className="text-sm text-rose-700">
          کپی لینک ممکن نشد. لینک را دستی از بالا بردارید.
        </p>
      ) : null}
    </div>
  );
}
