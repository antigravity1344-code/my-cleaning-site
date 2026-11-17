import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isPakshoConfigured, PakshoApiError, trackOrder, type PublicOrderSummary } from '../services/pakshoApi';
import {
  isAcceptedTrackingCode,
  normalizeTrackingCode,
  PAKSHO_TRACKING_CODE_PATTERN,
} from '../services/trackingCodeFormat';
import { parseTrackPath } from '../services/trackRoute';

export { normalizeTrackingCode, PAKSHO_TRACKING_CODE_PATTERN as TRACKING_CODE_PATTERN };

/** برچسب فارسی وضعیت‌های واقعی پاکشو (همان برچسب‌های سرور). */
export const TRACK_STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار متخصص',
  ACCEPTED: 'پذیرفته‌شده',
  CONFIRMED: 'تأیید شده',
  ASSIGNED: 'تخصیص متخصص',
  IN_PROGRESS: 'در حال انجام',
  COMPLETED: 'انجام شده',
  CANCELLED: 'لغو شده',
  CANCEL_REQUESTED: 'درخواست لغو در حال بررسی',
};

export function trackStatusLabel(status: string): string {
  return TRACK_STATUS_LABELS[status] ?? 'وضعیت جدید';
}

const INVALID_CODE_MESSAGE = 'کد پیگیری معتبر نیست. نمونه: ORD-…-xxxxxxxx';

type OrderTrackingPageProps = {
  /** برای آزمون؛ در اجرا از `window.location.pathname` خوانده می‌شود. */
  pathname?: string;
};

export const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ pathname }) => {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PublicOrderSummary | null>(null);
  const autoLookupKey = useRef<string | null>(null);

  const configured = isPakshoConfigured();

  const lookup = useCallback(async (raw: string) => {
    const normalized = normalizeTrackingCode(raw);
    setCode(normalized);
    setResult(null);
    setError('');
    if (!isAcceptedTrackingCode(normalized)) {
      setError(INVALID_CODE_MESSAGE);
      return;
    }
    setPending(true);
    try {
      const order = await trackOrder(normalized);
      if (!order) {
        setError('سفارشی با این کد پیدا نشد.');
      } else {
        setResult(order);
      }
    } catch (err) {
      setError(
        err instanceof PakshoApiError && err.status === 429
          ? 'تعداد درخواست پیگیری زیاد است. کمی بعد دوباره تلاش کنید.'
          : 'در حال حاضر امکان پیگیری نیست. بعداً دوباره تلاش کنید.',
      );
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    const path = pathname ?? window.location.pathname;
    const parsed = parseTrackPath(path);
    if (parsed.kind === 'base') return;
    if (parsed.kind === 'invalid') {
      setError(INVALID_CODE_MESSAGE);
      return;
    }
    if (autoLookupKey.current === parsed.raw) return;
    autoLookupKey.current = parsed.raw;
    void lookup(parsed.raw);
  }, [configured, pathname, lookup]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await lookup(code);
  };

  return (
    <main dir="rtl" className="paksho-public" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16, fontWeight: 700 }}>پیگیری سفارش</h1>

      {!configured && (
        <p role="status">پیگیری آنلاین در این نسخه فعال نیست.</p>
      )}

      {configured && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="track-code" style={{ display: 'block', marginBottom: 8 }}>
            کد پیگیری
          </label>
          <input
            id="track-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ORD-…-xxxxxxxx"
            autoComplete="off"
            dir="ltr"
            style={{ width: '100%', padding: '12px 16px', marginBottom: 16, boxSizing: 'border-box' }}
          />
          <button type="submit" disabled={pending || code.trim() === ''}>
            {pending ? 'در حال جست‌وجو…' : 'پیگیری'}
          </button>
        </form>
      )}

      {error && <p role="alert" style={{ marginTop: 16, color: '#B91C1C', background: '#FDECEC', borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04)' }}>{error}</p>}

      {result && (
        <section aria-live="polite" style={{ marginTop: 24, background: '#FFFFFF', borderRadius: 16, padding: 16, boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.04)' }}>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
            <dt>وضعیت</dt>
            <dd>{trackStatusLabel(result.status)}</dd>
            <dt>خدمت</dt>
            <dd>{result.serviceTitle}</dd>
            <dt>تاریخ</dt>
            <dd>{result.date ?? '—'}</dd>
            <dt>ساعت</dt>
            <dd>{result.time ?? '—'}</dd>
            <dt>منطقه</dt>
            <dd>{result.area ?? '—'}</dd>
          </dl>
        </section>
      )}
      </div>
    </main>
  );
};
