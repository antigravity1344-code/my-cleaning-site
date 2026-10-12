import type { BookingOrder } from '../types';

/**
 * حفاظت از اطلاعات شخصی مشتری در نسخه آزمایشی.
 *
 * سایت هیچ سروری ندارد، بنابراین اطلاعات مشتری ناچار در مرورگر می‌ماند. برای
 * کمینه‌کردن ریسک:
 *   ۱) اطلاعات مستقیم هویتی (نام کامل، شماره تماس، نشانی دقیق، واحد، توضیحات) هرگز
 *      به‌صورت خام در localStorage نوشته نمی‌شوند و پیش از ذخیره ماسک/حذف می‌شوند.
 *   ۲) کلید ذخیره‌سازی نسخه‌بندی شده و کلید قدیمی (که ممکن بود اطلاعات خام داشته
 *      باشد) پاک می‌شود.
 *   ۳) در حافظه همان نشست، اطلاعات کامل برای نمایش به خود کاربر نگه داشته می‌شود.
 */

/** کلید نسخه‌دار جدید ذخیره‌سازی سفارش‌های آزمایشی. */
export const DEMO_STORAGE_KEY = 'paksho_demo_orders_v2';

/** کلید نسخه قبلی که اطلاعات خام مشتری را ذخیره می‌کرد و باید پاک شود. */
export const LEGACY_STORAGE_KEYS = ['paksho_orders'] as const;

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** تبدیل ارقام فارسی/عربی به لاتین برای پردازش. */
export const toLatinDigits = (value: string): string =>
  value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);
    if (persianIndex >= 0) return String(persianIndex);
    return String(ARABIC_DIGITS.indexOf(digit));
  });

/**
 * ماسک‌کردن شماره تماس: فقط ۴ رقم ابتدایی و ۳ رقم انتهایی باقی می‌ماند.
 * مثال: ۰۹۱۲۳۴۵۶۷۸۹ → ۰۹۱۲***۷۸۹
 */
export const maskPhone = (phone: string): string => {
  const digits = toLatinDigits(phone).replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  const head = digits.slice(0, 4);
  const tail = digits.slice(-3);
  return `${head}***${tail}`;
};

/**
 * ماسک‌کردن نام: نمایش حرف اول هر بخش.
 * مثال: «سارا محمدی» → «س. م.»
 */
export const maskName = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.map((part) => `${part.charAt(0)}.`).join(' ');
};

export const REDACTED_PLACEHOLDER = '(در نسخه آزمایشی ذخیره نمی‌شود)';

/**
 * آماده‌سازی سفارش برای ذخیره‌سازی: حذف/ماسک هر داده‌ای که برای نمایش آزمایشی
 * ضرورت ندارد.
 */
export const redactOrderForStorage = (order: BookingOrder): BookingOrder => ({
  ...order,
  customerName: maskName(order.customerName),
  customerPhone: maskPhone(order.customerPhone),
  address: REDACTED_PLACEHOLDER,
  unit: '',
  notes: undefined,
  // شماره متخصص هرگز در نسخه آزمایشی تولید یا ذخیره نمی‌شود.
  cleanerPhone: undefined,
});

/** آیا این شیء حاوی اطلاع مستقیم هویتی مشتری است؟ (برای آزمون‌ها و پایش) */
export const containsRawCustomerPii = (order: BookingOrder): boolean => {
  const phoneDigits = toLatinDigits(order.customerPhone).replace(/\D/g, '');
  const looksLikeRawPhone = phoneDigits.length >= 10;
  const looksLikeRawName = !order.customerName.includes('.') && order.customerName.trim().split(/\s+/).length > 1;
  const hasRawAddress = order.address !== REDACTED_PLACEHOLDER && order.address.trim().length > 0;
  return looksLikeRawPhone || looksLikeRawName || hasRawAddress;
};

/** حذف کلیدهای نسخه قبلی که ممکن است اطلاعات خام مشتری داشته باشند. */
export const purgeLegacyStorage = (storage: Pick<Storage, 'removeItem'> | undefined = safeLocalStorage()): void => {
  if (!storage) return;
  LEGACY_STORAGE_KEYS.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // نادیده گرفتن خطای دسترسی به حافظه (مثلاً حالت ناشناس مرورگر)
    }
  });
};

export function safeLocalStorage(): Storage | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage;
  } catch {
    return undefined;
  }
}
