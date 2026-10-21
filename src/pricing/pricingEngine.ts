import { ADDON_OPTIONS, DISCOUNT_CODES, SERVICES_LIST } from '../data/mockData';
import type { ServiceType } from '../types';
import { SERVER_SIDE_PRICING_AVAILABLE } from '../config/capabilities';
import {
  normalizePromoCode,
  priceSelection,
  resolvePromoCode,
  type CorePriceBreakdown,
  type PriceLine,
  type PricingCatalog,
  type PricingDependencies,
  type PricingInput as CorePricingInput,
  type PromoCodeResult,
  type PromoLookup,
} from './pricingCore';

/**
 * اتصال هستهٔ قیمت به دادهٔ **نسخهٔ نمایشی** — تنها منبع محاسبهٔ قیمت در واسط کاربری.
 *
 * پیش از این، محاسبه‌گر هزینه و فرم رزرو هرکدام منطق و پیکربندی مستقل خود را داشتند
 * و برای ورودی یکسان، مبلغ متفاوت نشان می‌دادند. اکنون تنها راه محاسبه قیمت در
 * رابط کاربری، فراخوانی `calculatePrice` است.
 *
 * محاسبه در `pricingCore.ts` انجام می‌شود که به `mockData` وابسته نیست. این فایل فقط
 * کاتالوگ نمایشی (خدمات و افزودنی‌های نمونه) و فهرست **نمونهٔ** کدهای تخفیف را به
 * هسته می‌دهد. سرور باید کاتالوگ و کدهای خودش را به همان هسته بدهد، نه این فایل را.
 *
 * ⚠️ این محاسبات «پیشنهادی/آزمایشی» است. در نسخه نهایی، مبلغ معتبر باید توسط سرور
 * پاک‌شو محاسبه شود و مبلغ محاسبه‌شده در مرورگر نباید مبنای دریافت وجه باشد.
 */

export interface PricingConfig {
  /** قیمت پکیج مواد شوینده و دستمال نانو (تومان). */
  detergentPackagePrice: number;
  /**
   * نرخ تخفیف سراسری «رزرو آنلاین».
   *
   * ⚠️ ابهام کسب‌وکاری تأییدنشده:
   * در نسخه قبلی این تخفیف ۵٪ در محاسبه‌گر اعمال می‌شد اما در فاکتور رزرو اعمال
   * نمی‌شد و شرایط دقیق آن (نوع خدمت، بازه زمانی، سقف، کاربر هدف) هیچ‌جا تعریف نشده
   * بود. در اپلیکیشن موبایل نیز مدل تخفیف متفاوتی (رزرو زودهنگام و سطح وفاداری)
   * وجود دارد. بنابراین تا زمان تأیید رسمی سیاست تجاری، مقدار آن `null` است و
   * هیچ تخفیف سراسری‌ای در هیچ نمایی اعمال یا وعده داده نمی‌شود.
   *
   * برای فعال‌سازی پس از تصمیم رسمی، فقط همین مقدار را به نرخ تأییدشده تغییر دهید؛
   * محاسبه‌گر و فاکتور به‌صورت خودکار یکسان خواهند شد.
   */
  onlineBookingDiscountRate: number | null;
}

export const PRICING_CONFIG: PricingConfig = {
  detergentPackagePrice: 140_000,
  onlineBookingDiscountRate: null,
};

export const PROVISIONAL_PRICING_NOTE =
  'مبلغ پیشنهادی و آزمایشی است؛ مبلغ نهایی توسط سرور پاک‌شو محاسبه و تأیید می‌شود.';

/** سقف ساعت فعلی فرم رزرو و محاسبه‌گر. */
export const DEMO_MAX_HOURS = 12;

/**
 * کاتالوگ قیمت نسخهٔ نمایشی، ساخته‌شده از دادهٔ نمونه.
 * ترتیب خدمات همان ترتیب `SERVICES_LIST` است (خدمت ناشناخته در مسیر اصلاح‌گر با اولین خدمت قیمت می‌خورد).
 */
export const DEMO_PRICING_CATALOG: PricingCatalog<ServiceType> = {
  services: SERVICES_LIST.map((service) => ({
    id: service.id,
    title: service.title,
    hourlyRate: service.baseHourlyRate,
    minHours: service.minHours,
  })),
  addons: ADDON_OPTIONS.map((addon) => ({ id: addon.id, title: addon.title, price: addon.price })),
  detergentPackagePrice: PRICING_CONFIG.detergentPackagePrice,
  onlineBookingDiscountRate: PRICING_CONFIG.onlineBookingDiscountRate,
  maxHours: DEMO_MAX_HOURS,
};

/** کدهای تخفیف **نمونه**؛ فقط برای نمایش. فقط کلیدهای خودِ فهرست پذیرفته می‌شوند. */
const lookupDemoPromo: PromoLookup = (code) =>
  Object.prototype.hasOwnProperty.call(DISCOUNT_CODES, code) ? DISCOUNT_CODES[code] : undefined;

export const DEMO_PRICING_DEPENDENCIES: PricingDependencies<ServiceType> = {
  catalog: DEMO_PRICING_CATALOG,
  lookupPromo: lookupDemoPromo,
};

export type PricingInput = CorePricingInput<ServiceType>;
export type { PriceLine, PromoCodeResult };

export interface PriceBreakdown extends CorePriceBreakdown<ServiceType> {
  isProvisional: boolean;
  provisionalNote: string;
}

export { normalizePromoCode };

/**
 * اعتبارسنجی سمت کلاینت کد تخفیف — صرفاً برای نمایش آزمایشی.
 * حذف کدهای تکراری/نامعتبر و اعتبارسنجی نهایی سمت سرور انجام می‌شود.
 */
export const validatePromoCode = (rawCode: string): PromoCodeResult =>
  resolvePromoCode(rawCode, lookupDemoPromo);

/**
 * محاسبه کامل قیمت از روی ورودی‌های خام (مسیر اصلاح‌گر هسته، با کاتالوگ نمایشی).
 * تابع خالص (pure) است: ورودی یکسان همیشه خروجی یکسان می‌دهد.
 */
export const calculatePrice = (input: PricingInput): PriceBreakdown => ({
  ...priceSelection(DEMO_PRICING_DEPENDENCIES, input),
  isProvisional: !SERVER_SIDE_PRICING_AVAILABLE,
  provisionalNote: PROVISIONAL_PRICING_NOTE,
});

/** برآورد تعداد ساعت پیشنهادی بر اساس مشخصات فضا (منطق موجود، منتقل‌شده به موتور مشترک). */
export interface RecommendedHoursInput {
  serviceId: ServiceType;
  squareMeters: number;
  roomsCount: number;
  bathroomsCount: number;
}

export const calculateRecommendedHours = ({
  serviceId,
  squareMeters,
  roomsCount,
  bathroomsCount,
}: RecommendedHoursInput): number => {
  const service =
    DEMO_PRICING_CATALOG.services.find((item) => item.id === serviceId) ?? DEMO_PRICING_CATALOG.services[0];

  let baseHours = 4;
  if (squareMeters <= 90) baseHours = 4;
  else if (squareMeters <= 130) baseHours = 5;
  else if (squareMeters <= 170) baseHours = 6;
  else if (squareMeters <= 220) baseHours = 7;
  else baseHours = 8;

  if (roomsCount >= 3) baseHours += 1;
  if (bathroomsCount >= 2) baseHours += 1;
  if (serviceId === 'home-deep') baseHours += 2;
  if (serviceId === 'post-construction') baseHours += 2;

  return Math.max(service.minHours, Math.min(DEMO_MAX_HOURS, baseHours));
};

/** مقایسه دو برآورد قیمت برای اطمینان از یکسان‌بودن مبلغ نمایش‌داده‌شده به کاربر. */
export const isSameTotal = (a: PriceBreakdown, b: PriceBreakdown): boolean =>
  a.total === b.total && a.subtotal === b.subtotal && a.discountsTotal === b.discountsTotal;
