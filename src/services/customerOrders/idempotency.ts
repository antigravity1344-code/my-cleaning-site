/**
 * کلید یکتای یک تلاش ثبت سفارش (Idempotency-Key).
 *
 * شکل خروجی با هر دو بک‌اند سازگار است: حروف و رقم لاتین و `-`، طول ۳۶ (UUID نسخهٔ ۴).
 * قاعدهٔ اپ موبایل برای `clientRequestId` (`^[A-Za-z0-9_-]{8,64}$`) را هم برآورده می‌کند.
 */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

type CryptoLike = Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>>;

export const createIdempotencyKey = (cryptoApi: CryptoLike | null = globalThis.crypto ?? null): string => {
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
    // بدون مولد امن، کلید ساخته نمی‌شود؛ ثبت بدون کلید یکتا امن نیست.
    throw new Error('مولد اعداد تصادفی امن در این مرورگر در دسترس نیست.');
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
