import { isAcceptedTrackingCode, normalizeTrackingCode } from '../services/trackingCodeFormat';

/**
 * لینک پیگیری اختصاصی سفارش برای نسخهٔ متصل (API اصلی پاکشو).
 *
 * قالب: `https://pakshu.ir/track/<ORD-…>`
 * فقط کد ORD معتبر لینک می‌شود؛ کد Crockford مستقل لینک ساخته نمی‌شود.
 */
export const PUBLIC_TRACK_ORIGIN = 'https://pakshu.ir';
export const PUBLIC_TRACK_PAGE_URL = `${PUBLIC_TRACK_ORIGIN}/track`;

/** اگر کد خالی یا فقط فاصله باشد، null برمی‌گرداند — کد ساختگی ساخته نمی‌شود. */
export function usableTrackingCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/** لینک اختصاصی همان سفارش ORD؛ ورودی نامعتبر یا غیر ORD لینک نمی‌سازد. */
export function buildDedicatedTrackUrl(
  trackingCode: string | null | undefined,
  origin: string = PUBLIC_TRACK_ORIGIN,
): string | null {
  const code = usableTrackingCode(trackingCode);
  if (!code) return null;
  const normalized = normalizeTrackingCode(code);
  if (!isAcceptedTrackingCode(normalized)) return null;
  const base = origin.replace(/\/+$/, '');
  return `${base}/track/${encodeURIComponent(normalized)}`;
}
