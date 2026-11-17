/**
 * اعتبارسنجی کد رهگیری برای نسخهٔ متصل سایت (pakshu.ir → API اصلی پاکشو).
 *
 * فقط قالب ORD سرور پاکشو پذیرفته می‌شود. کدهای Crockford بک‌اند مستقل
 * (`server/trackingCode.js` / standaloneBackend) متعلق به DB جدا هستند و در
 * این نسخه عمداً رد می‌شوند تا به API اشتباه فرستاده نشوند.
 */

/** الگوی سرور پاکشو پس از normalizeTrackingCode. */
export const PAKSHO_TRACKING_CODE_PATTERN = /^ORD-[0-9A-Z]+-[0-9a-f]{8}$/;

/**
 * الگوی generateTrackingCode مستقل (فقط برای مستندسازی/آزمون رد کردن).
 * در نسخهٔ متصل در isAcceptedTrackingCode استفاده نمی‌شود.
 */
export const STANDALONE_TRACKING_CODE_PATTERN =
  /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

const PERSIAN_DIGITS = /[۰-۹]/g;

function mapPersianDigits(value: string): string {
  return value.replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** نرمال‌سازی قرارداد پاکشو: بخش پایانی هگز کوچک. */
export function normalizeTrackingCode(raw: string): string {
  const upper = mapPersianDigits(raw.trim()).toUpperCase();
  const cut = upper.lastIndexOf('-');
  return cut === -1 ? upper : upper.slice(0, cut + 1) + upper.slice(cut + 1).toLowerCase();
}

/** فقط ORD معتبر پاکشو — نسخهٔ متصل. */
export function isAcceptedTrackingCode(normalized: string): boolean {
  return PAKSHO_TRACKING_CODE_PATTERN.test(normalized);
}
