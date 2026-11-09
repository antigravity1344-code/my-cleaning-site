/**
 * پیکربندی قیمت سمت سرور — حالت مستقل.
 *
 * ⚠️ جایگزین قطعی نیست. مقادیر پایین دقیقاً همان دادهٔ نمایشی فعلی است
 * (`src/data/mockData.ts` در فرانت). پیش از راه‌اندازی واقعی (نه پیش از ساخت)،
 * مالک باید خدمات، نرخ‌ها، افزودنی‌ها، کدهای تخفیف و شهرها را نهایی کند
 * (سند عملیاتی، بخش ۱۱ — «ورودی‌های لازم پیش از راه‌اندازی»).
 *
 * این فایل عمداً جدا از فرانت است (فرانت TypeScript است، سرور اینجا ساده و
 * بدون مرحلهٔ build اجرا می‌شود) تا هیچ کد تخفیفی در bundle مرورگر نباشد —
 * برخلاف وضعیت فعلی که در sources/data/mockData.ts همه‌چیز در bundle خوانده
 * می‌شود (سند عملیاتی، بخش ۱۲.۱).
 */

export const SERVICES = [
  { id: 'home-standard', baseHourlyRate: 160000, minHours: 4, title: 'نظافت استاندارد منزل' },
  { id: 'home-deep', baseHourlyRate: 190000, minHours: 5, title: 'نظافت عمیق و تخصصی (خانه‌تکانی)' },
  { id: 'office', baseHourlyRate: 175000, minHours: 4, title: 'نظافت دفاتر و شرکت‌ها' },
  { id: 'building-staircase', baseHourlyRate: 155000, minHours: 4, title: 'نظافت راه‌پله، پارکینگ و مشاعات' },
  { id: 'furniture-carpet', baseHourlyRate: 220000, minHours: 3, title: 'مبل‌شویی و فرش‌شویی در محل' },
  { id: 'post-construction', baseHourlyRate: 200000, minHours: 6, title: 'نظافت بعد از بازسازی و اسباب‌کشی' },
];

export const ADDONS = [
  { id: 'walls', price: 180000, title: 'دیوارشویی تخصصی اتاق‌ها' },
  { id: 'windows', price: 130000, title: 'شستشوی کامل شیشه‌ها و بالکن' },
  { id: 'appliances', price: 150000, title: 'تمیزکاری عمیق داخل یخچال و فر' },
  { id: 'ironing', price: 110000, title: 'اتوکشی و مرتب‌سازی البسه و پرده' },
  { id: 'detergents', price: 140000, title: 'پکیج کامل مواد شوینده و دستمال نانو' },
];

export const DETERGENT_PACKAGE_PRICE = 140_000;

/** کد تخفیف → مبلغ (تومان). هرگز به مرورگر فرستاده نمی‌شود. */
export const DISCOUNT_CODES = {
  PAK1403: 100000,
  NEWCUSTOMER: 150000,
  OFFER20: 80000,
};

/** طبق PRICING_CONFIG.onlineBookingDiscountRate فعلی: تا تصمیم رسمی مالک، null. */
export const ONLINE_BOOKING_DISCOUNT_RATE = null;

export const MAX_HOURS = 12;

export const findService = (serviceId) => SERVICES.find((service) => service.id === serviceId) ?? null;

export const findAddon = (addonId) => ADDONS.find((addon) => addon.id === addonId) ?? null;
