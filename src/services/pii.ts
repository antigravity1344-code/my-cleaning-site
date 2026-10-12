import type { BookingOrder } from '../types';

/**
 * حفاظت از اطلاعات شخصی مشتری در نسخه آزمایشی.
 *
 * سایت هیچ سروری ندارد، بنابراین اطلاعات مشتری ناچار در مرورگر می‌ماند. برای
 * کمینه‌کردن ریسک:
 *   ۱) اطلاعات مستقیم هویتی (نام کامل، شماره تماس، نشانی دقیق، واحد، توضیحات و
 *      متن آزاد بازخورد) هرگز در localStorage نوشته نمی‌شوند.
 *   ۲) کلید ذخیره‌سازی نسخه‌بندی شده تا از کلید نسخه قبلی جدا باشد.
 *   ۳) در حافظه همان نشست، اطلاعات کامل برای نمایش به خود کاربر نگه داشته می‌شود.
 *
 * ⚠️ سیاست عدم مداخله در داده‌های قدیمی:
 * کلید نسخه قبلی (`paksho_orders`) ممکن است روی دستگاه کاربران داده داشته باشد.
 * این ماژول آن داده را **نمی‌خواند، منتقل نمی‌کند و حذف نمی‌کند**. حذف یا مهاجرت
 * آن نیازمند تصمیم جداگانه مالک داده است؛ در این‌جا فقط «وجود» آن گزارش می‌شود
 * و هیچ محتوایی از آن نمایش داده نمی‌شود.
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
/**
 * ساخت نسخه قابل‌ذخیره سفارش.
 *
 * به‌جای spread از یک **فهرست سفید صریح** استفاده می‌شود تا هیچ فیلد جدیدی
 * به‌طور تصادفی در آینده به حافظه مرورگر راه پیدا نکند. هر فیلدی که در این
 * فهرست نیامده باشد (از جمله متن آزاد بازخورد و هر فیلد آینده) ذخیره نمی‌شود.
 */
export const redactOrderForStorage = (order: BookingOrder): BookingOrder => ({
  id: order.id,
  trackingCode: order.trackingCode,
  createdAt: order.createdAt,
  status: order.status,
  recordType: order.recordType,
  paymentStatus: order.paymentStatus,
  serviceId: order.serviceId,
  serviceTitle: order.serviceTitle,
  cleanerGender: order.cleanerGender,
  // تخصیص واقعی متخصص در نسخه آزمایشی وجود ندارد؛ فقط «درخواست» نگه داشته می‌شود.
  requestedCleanerId: order.requestedCleanerId,
  requestedCleanerName: order.requestedCleanerName,
  hours: order.hours,
  squareMeters: order.squareMeters,
  roomsCount: order.roomsCount,
  selectedAddons: order.selectedAddons,
  hasDetergentPackage: order.hasDetergentPackage,
  date: order.date,
  timeSlot: order.timeSlot,
  cityName: order.cityName,
  district: order.district,
  // ── داده‌های حساس: ماسک یا حذف ──
  customerName: maskName(order.customerName),
  customerPhone: maskPhone(order.customerPhone),
  address: REDACTED_PLACEHOLDER,
  unit: '',
  notes: undefined,
  // شماره متخصص هرگز در نسخه آزمایشی تولید یا ذخیره نمی‌شود.
  cleanerPhone: undefined,
  cleanerId: undefined,
  cleanerName: undefined,
  cleanerAvatar: undefined,
  totalPrice: order.totalPrice,
  discountApplied: order.discountApplied,
  paymentMethod: order.paymentMethod,
  userRating: order.userRating,
  // توجه: متن آزاد بازخورد (`userFeedback`) عمداً در فهرست سفید نیست.
});

/** الگوی شماره موبایل ایران (با ارقام لاتین پس از نرمال‌سازی). */
export const IRAN_MOBILE_PATTERN = /0?9\d{9}/;

/** آیا این متن آزاد حاوی شماره تماس یا نشانی است؟ */
export const containsPiiInFreeText = (value: string | undefined): boolean => {
  if (!value) return false;
  const normalized = toLatinDigits(value);
  return IRAN_MOBILE_PATTERN.test(normalized.replace(/[\s()-]/g, ''));
};

/**
 * آیا این رکورد حاوی اطلاع مستقیم هویتی مشتری است؟ (برای آزمون‌ها و پایش)
 * رکوردهای قدیمی که ممکن است متن آزاد بازخورد داشته باشند هم بررسی می‌شوند.
 */
export const containsRawCustomerPii = (order: BookingOrder): boolean => {
  const phoneDigits = toLatinDigits(order.customerPhone).replace(/\D/g, '');
  const looksLikeRawPhone = phoneDigits.length >= 10;
  const looksLikeRawName = !order.customerName.includes('.') && order.customerName.trim().split(/\s+/).length > 1;
  const hasRawAddress = order.address !== REDACTED_PLACEHOLDER && order.address.trim().length > 0;
  const legacyFeedback = (order as BookingOrder & { userFeedback?: string }).userFeedback;
  const feedbackHasPii = containsPiiInFreeText(legacyFeedback);
  return looksLikeRawPhone || looksLikeRawName || hasRawAddress || feedbackHasPii;
};

/**
 * آیا داده‌ای از نسخه قبلی سایت روی این مرورگر وجود دارد؟
 *
 * این تابع فقط «وجود» را بررسی می‌کند؛ محتوا را نمی‌خواند، نمایش نمی‌دهد،
 * منتقل نمی‌کند و حذف نمی‌کند. تصمیم درباره حذف یا مهاجرت با مالک داده است.
 */
export const hasLegacyStoredData = (
  storage: Pick<Storage, 'getItem'> | undefined = safeLocalStorage(),
): boolean => {
  if (!storage) return false;
  return LEGACY_STORAGE_KEYS.some((key) => {
    try {
      const value = storage.getItem(key);
      return typeof value === 'string' && value.length > 0;
    } catch {
      // در صورت خطای دسترسی، فرض می‌کنیم داده‌ای قابل بررسی نیست.
      return false;
    }
  });
};

/** پیام اطلاع‌رسانی به کاربر درباره داده‌های نسخه قبلی (بدون نمایش محتوا). */
export const LEGACY_DATA_NOTICE =
  'در همین مرورگر داده‌ای از نسخه قبلی سایت پیدا شد. آن داده خوانده، منتقل، نمایش داده ' +
  'یا حذف نمی‌شود و در فهرست آزمایشی زیر هم قرار نمی‌گیرد. حذف یا انتقال آن نیازمند ' +
  'تصمیم خود شماست.';

export function safeLocalStorage(): Storage | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    return localStorage;
  } catch {
    return undefined;
  }
}
