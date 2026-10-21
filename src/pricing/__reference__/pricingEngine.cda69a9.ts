/**
 * ⚠️ نسخهٔ مرجعِ منجمد — فقط برای آزمون مقایسه‌ای. در کد برنامه import نشود و ویرایش نشود.
 *
 * بدنهٔ زیر عیناً از `src/pricing/pricingEngine.ts` در `main` `cda69a9` (پیش از جداسازی
 * هستهٔ قیمت) کپی شده است. فقط این توضیح اضافه شده، مسیر import ها یک پوشه عمیق‌تر شده و
 * دو تابعی که آزمون لازم ندارد (calculateRecommendedHours و isSameTotal) حذف شده‌اند.
 * آزمون `pricingCore.equivalence.test.ts` خروجی موتور جدید را روی ماتریس بزرگی از
 * ورودی‌ها، از جمله ورودی‌های نامعتبر، با همین نسخه مقایسه می‌کند تا ثابت شود مبالغ
 * فعلی نسخهٔ نمایشی تغییر نکرده‌اند.
 */
import { ADDON_OPTIONS, DISCOUNT_CODES, SERVICES_LIST } from '../../data/mockData';
import type { AddonOption, ServiceItem, ServiceType } from '../../types';
import { SERVER_SIDE_PRICING_AVAILABLE } from '../../config/capabilities';

/**
 * موتور قیمت‌گذاری مشترک پاک‌شو — تنها منبع حقیقت محاسبات قیمت در وب‌سایت.
 *
 * پیش از این، محاسبه‌گر هزینه و فرم رزرو هرکدام منطق و پیکربندی مستقل خود را داشتند
 * و برای ورودی یکسان، مبلغ متفاوت نشان می‌دادند. اکنون تنها راه محاسبه قیمت در
 * رابط کاربری، فراخوانی `calculatePrice` است.
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

const findService = (serviceId: ServiceType): ServiceItem =>
  SERVICES_LIST.find((service) => service.id === serviceId) ?? SERVICES_LIST[0];

const findAddon = (addonId: string): AddonOption | undefined =>
  ADDON_OPTIONS.find((addon) => addon.id === addonId);

export const normalizePromoCode = (code: string): string => code.trim().toUpperCase();

/**
 * اعتبارسنجی سمت کلاینت کد تخفیف — صرفاً برای نمایش آزمایشی.
 * حذف کدهای تکراری/نامعتبر و اعتبارسنجی نهایی سمت سرور انجام می‌شود.
 */
export const validatePromoCode = (rawCode: string): PromoCodeResult => {
  const code = normalizePromoCode(rawCode);
  if (!code) return { code, valid: false, amount: 0 };
  const amount = DISCOUNT_CODES[code];
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { code, valid: false, amount: 0 };
  }
  return { code, valid: true, amount };
};

/** تخفیف سراسری فقط زمانی اعمال می‌شود که سیاست آن تأیید شده باشد. */
const calculateVerifiedGlobalDiscount = (subtotal: number): number => {
  const rate = PRICING_CONFIG.onlineBookingDiscountRate;
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return 0;
  const rounded = Math.round((subtotal * rate) / 1000) * 1000;
  return Math.min(rounded, subtotal);
};

/**
 * محاسبه کامل و قطعی قیمت از روی ورودی‌های خام.
 * تابع خالص (pure) است: ورودی یکسان همیشه خروجی یکسان می‌دهد.
 */
export const calculatePrice = (input: PricingInput): PriceBreakdown => {
  const service = findService(input.serviceId);
  const hours = Number.isFinite(input.hours) ? Math.max(1, Math.floor(input.hours)) : 1;
  const hourlyRate = service.baseHourlyRate;
  const serviceBase = hourlyRate * hours;

  // حذف خدمات تکراری تا یک قلم دو بار محاسبه نشود.
  const uniqueAddonIds = Array.from(new Set(input.addonIds));
  const addonLines: PriceLine[] = uniqueAddonIds
    .map(findAddon)
    .filter((addon): addon is AddonOption => Boolean(addon))
    .map((addon) => ({ id: addon.id, title: addon.title, amount: addon.price }));
  const addonsTotal = addonLines.reduce((sum, line) => sum + line.amount, 0);

  const detergentCost = input.hasDetergentPackage ? PRICING_CONFIG.detergentPackagePrice : 0;
  const subtotal = serviceBase + addonsTotal + detergentCost;

  const rawDiscountLines: PriceLine[] = [];
  const globalDiscount = calculateVerifiedGlobalDiscount(subtotal);
  if (globalDiscount > 0) {
    rawDiscountLines.push({ id: 'online-booking', title: 'تخفیف رزرو آنلاین', amount: globalDiscount });
  }
  if (input.promoCode) {
    const promo = validatePromoCode(input.promoCode);
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

