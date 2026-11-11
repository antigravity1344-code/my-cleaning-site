import type { AddonOption, ServiceItem, ServiceType } from '../types';
import { SERVER_SIDE_PRICING_AVAILABLE } from '../config/capabilities';
import { DEFAULT_PRICING_DATA, type PricingData } from './pricingData';

/**
 * موتور قیمت‌گذاری مشترک پاک‌شو — تنها منبع حقیقت محاسبات قیمت در وب‌سایت.
 *
 * پیش از این، محاسبه‌گر هزینه و فرم رزرو هرکدام منطق و پیکربندی مستقل خود را داشتند
 * و برای ورودی یکسان، مبلغ متفاوت نشان می‌دادند. اکنون تنها راه محاسبه قیمت در
 * رابط کاربری، فراخوانی `calculatePrice` است.
 *
 * ⚠️ این محاسبات «پیشنهادی/آزمایشی» است. در نسخه نهایی، مبلغ معتبر باید توسط سرور
 * پاک‌شو محاسبه شود و مبلغ محاسبه‌شده در مرورگر نباید مبنای دریافت وجه باشد.
 *
 * این موتور دیگر مستقیماً از `mockData` نمی‌خواند؛ هر تابع یک `PricingData` می‌گیرد
 * (پیش‌فرض: `DEFAULT_PRICING_DATA`، یعنی همان دادهٔ نمایشی قبلی). این‌طوری بعداً
 * فراخوانی با دادهٔ واقعیِ سرور ممکن می‌شود، بدون تغییر رفتار فعلی.
 */

/** برای سازگاری با کد موجود (نمایش در CostCalculator/BookingModal) نگه داشته شده. */
export interface PricingConfig {
  detergentPackagePrice: number;
  onlineBookingDiscountRate: number | null;
}

export const PRICING_CONFIG: PricingConfig = {
  detergentPackagePrice: DEFAULT_PRICING_DATA.detergentPackagePrice,
  onlineBookingDiscountRate: DEFAULT_PRICING_DATA.onlineBookingDiscountRate,
};

export const PROVISIONAL_PRICING_NOTE =
  'مبلغ پیشنهادی و آزمایشی است؛ مبلغ نهایی توسط سرور پاک‌شو محاسبه و تأیید می‌شود.';

export interface PricingInput {
  serviceId: ServiceType;
  hours: number;
  addonIds: string[];
  hasDetergentPackage: boolean;
  /** کد تخفیف اختیاری؛ اعتبارسنجی نهایی آن سمت سرور انجام می‌شود. */
  promoCode?: string;
}

export interface PriceLine {
  id: string;
  title: string;
  amount: number;
}

export interface PriceBreakdown {
  serviceId: ServiceType;
  serviceTitle: string;
  hours: number;
  hourlyRate: number;
  serviceBase: number;
  addonLines: PriceLine[];
  addonsTotal: number;
  detergentCost: number;
  subtotal: number;
  discountLines: PriceLine[];
  discountsTotal: number;
  /** هرگز منفی نمی‌شود. */
  total: number;
  isProvisional: boolean;
  provisionalNote: string;
}

export interface PromoCodeResult {
  code: string;
  valid: boolean;
  amount: number;
}

const findService = (serviceId: ServiceType, data: PricingData): ServiceItem =>
  data.services.find((service) => service.id === serviceId) ?? data.services[0];

const findAddon = (addonId: string, data: PricingData): AddonOption | undefined =>
  data.addons.find((addon) => addon.id === addonId);

export const normalizePromoCode = (code: string): string => code.trim().toUpperCase();

/**
 * اعتبارسنجی سمت کلاینت کد تخفیف — صرفاً برای نمایش آزمایشی.
 * حذف کدهای تکراری/نامعتبر و اعتبارسنجی نهایی سمت سرور انجام می‌شود.
 */
export const validatePromoCode = (
  rawCode: string,
  discountCodes: Record<string, number> = DEFAULT_PRICING_DATA.discountCodes
): PromoCodeResult => {
  const code = normalizePromoCode(rawCode);
  if (!code) return { code, valid: false, amount: 0 };
  const amount = discountCodes[code];
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { code, valid: false, amount: 0 };
  }
  return { code, valid: true, amount };
};

/** تخفیف سراسری فقط زمانی اعمال می‌شود که سیاست آن تأیید شده باشد. */
const calculateVerifiedGlobalDiscount = (subtotal: number, rate: number | null): number => {
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return 0;
  const rounded = Math.round((subtotal * rate) / 1000) * 1000;
  return Math.min(rounded, subtotal);
};

/**
 * محاسبه کامل و قطعی قیمت از روی ورودی‌های خام.
 * تابع خالص (pure) است: ورودی یکسان همیشه خروجی یکسان می‌دهد.
 */
export const calculatePrice = (
  input: PricingInput,
  data: PricingData = DEFAULT_PRICING_DATA
): PriceBreakdown => {
  const service = findService(input.serviceId, data);
  const hours = Number.isFinite(input.hours) ? Math.max(1, Math.floor(input.hours)) : 1;
  const hourlyRate = service.baseHourlyRate;
  const serviceBase = hourlyRate * hours;

  // حذف خدمات تکراری تا یک قلم دو بار محاسبه نشود.
  const uniqueAddonIds = Array.from(new Set(input.addonIds));
  const addonLines: PriceLine[] = uniqueAddonIds
    .map((addonId) => findAddon(addonId, data))
    .filter((addon): addon is AddonOption => Boolean(addon))
    .map((addon) => ({ id: addon.id, title: addon.title, amount: addon.price }));
  const addonsTotal = addonLines.reduce((sum, line) => sum + line.amount, 0);

  const detergentCost = input.hasDetergentPackage ? data.detergentPackagePrice : 0;
  const subtotal = serviceBase + addonsTotal + detergentCost;

  const rawDiscountLines: PriceLine[] = [];
  const globalDiscount = calculateVerifiedGlobalDiscount(subtotal, data.onlineBookingDiscountRate);
  if (globalDiscount > 0) {
    rawDiscountLines.push({ id: 'online-booking', title: 'تخفیف رزرو آنلاین', amount: globalDiscount });
  }
  if (input.promoCode) {
    const promo = validatePromoCode(input.promoCode, data.discountCodes);
    if (promo.valid) {
      rawDiscountLines.push({ id: `promo:${promo.code}`, title: `کد تخفیف ${promo.code}`, amount: promo.amount });
    }
  }

  // سقف‌گذاری تخفیف‌ها روی جمع اقلام: نه تخفیف دوباره، نه مبلغ منفی.
  let remaining = subtotal;
  const discountLines = rawDiscountLines
    .map((line) => {
      const amount = Math.max(0, Math.min(line.amount, remaining));
      remaining -= amount;
      return { ...line, amount };
    })
    .filter((line) => line.amount > 0);

  const discountsTotal = discountLines.reduce((sum, line) => sum + line.amount, 0);
  const total = Math.max(0, subtotal - discountsTotal);

  return {
    serviceId: service.id,
    serviceTitle: service.title,
    hours,
    hourlyRate,
    serviceBase,
    addonLines,
    addonsTotal,
    detergentCost,
    subtotal,
    discountLines,
    discountsTotal,
    total,
    isProvisional: !SERVER_SIDE_PRICING_AVAILABLE,
    provisionalNote: PROVISIONAL_PRICING_NOTE,
  };
};

/** برآورد تعداد ساعت پیشنهادی بر اساس مشخصات فضا (منطق موجود، منتقل‌شده به موتور مشترک). */
export interface RecommendedHoursInput {
  serviceId: ServiceType;
  squareMeters: number;
  roomsCount: number;
  bathroomsCount: number;
}

export const calculateRecommendedHours = (
  { serviceId, squareMeters, roomsCount, bathroomsCount }: RecommendedHoursInput,
  data: PricingData = DEFAULT_PRICING_DATA
): number => {
  const service = findService(serviceId, data);

  let baseHours = 4;
  if (squareMeters <= 90) baseHours = 4;
  else if (squareMeters <= 130) baseHours = 5;
  else if (squareMeters <= 170) baseHours = 6;
  else if (squareMeters <= 220) baseHours = 7;
  else baseHours = 8;

  if (roomsCount >= 3) baseHours += 1;
  if (bathroomsCount >= 2) baseHours += 1;
  if (serviceId === 'home-deep') baseHours += 2;

  return Math.max(service.minHours, Math.min(12, baseHours));
};

/** مقایسه دو برآورد قیمت برای اطمینان از یکسان‌بودن مبلغ نمایش‌داده‌شده به کاربر. */
export const isSameTotal = (a: PriceBreakdown, b: PriceBreakdown): boolean =>
  a.total === b.total && a.subtotal === b.subtotal && a.discountsTotal === b.discountsTotal;
