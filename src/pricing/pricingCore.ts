/**
 * هستهٔ خالص قیمت‌گذاری پاک‌شو.
 *
 * این ماژول عمداً **هیچ وابستگی‌ای** به `mockData`، تنظیمات نسخهٔ نمایشی، مرورگر یا
 * شبکه ندارد. همهٔ داده‌ها از ورودی می‌آیند:
 *   • `PricingCatalog`: خدمات، افزودنی‌ها، قیمت بستهٔ شوینده، سقف ساعت؛
 *   • `PromoLookup`: یافتن مبلغ کد تخفیف. هسته هیچ کد تخفیفی نمی‌شناسد؛ در نسخهٔ
 *     نمایشی فهرست نمونه و در سرور پیکربندی خود سرور تزریق می‌شود.
 *
 * بنابراین همین فایل را می‌توان بی‌تغییر در سرور (حالت مستقل) یا در adapter حالت
 * هماهنگ به کار برد، به شرط آن‌که کاتالوگ و کدهای تخفیف را خود سرور بدهد.
 *
 * دو مسیر وجود دارد:
 *   ۱) `priceSelection`: رفتار «اصلاح‌گر» فعلی واسط کاربری را عیناً حفظ می‌کند
 *      (خدمت ناشناخته ← اولین خدمت، افزودنی ناشناخته حذف، ساعت گرد و حداقل ۱).
 *      فقط برای برآورد نمایشی است.
 *   ۲) `validatePricingSelection` و `quoteStrict`: ورودی نادرست را **رد** می‌کنند.
 *      سرور باید فقط از این مسیر قیمت معتبر بسازد.
 */

export interface CatalogService<S extends string = string> {
  id: S;
  title: string;
  /** نرخ هر ساعت (عدد صحیح، به واحد پول کاتالوگ). */
  hourlyRate: number;
  /** حداقل ساعت مجاز این خدمت. */
  minHours: number;
}

export interface CatalogAddon {
  id: string;
  title: string;
  price: number;
}

export interface PricingCatalog<S extends string = string> {
  /** ترتیب مهم است: مسیر اصلاح‌گر، خدمت ناشناخته را با اولین خدمت قیمت می‌گذارد. */
  services: readonly CatalogService<S>[];
  addons: readonly CatalogAddon[];
  detergentPackagePrice: number;
  /** تخفیف سراسری تأییدشده؛ `null` یعنی هیچ تخفیف سراسری‌ای اعمال نمی‌شود. */
  onlineBookingDiscountRate: number | null;
  /** سقف ساعت مجاز برای اعتبارسنجی سخت‌گیرانه. */
  maxHours: number;
}

/** مبلغ کد تخفیفِ نرمال‌شده را برمی‌گرداند؛ کد ناشناخته ← `undefined`. */
export type PromoLookup = (normalizedCode: string) => number | undefined;

export interface PricingDependencies<S extends string = string> {
  catalog: PricingCatalog<S>;
  lookupPromo: PromoLookup;
}

export interface PricingInput<S extends string = string> {
  serviceId: S;
  hours: number;
  addonIds: string[];
  hasDetergentPackage: boolean;
  /** کد تخفیف اختیاری. */
  promoCode?: string;
}

export interface PriceLine {
  id: string;
  title: string;
  amount: number;
}

export interface CorePriceBreakdown<S extends string = string> {
  serviceId: S;
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
}

export interface PromoCodeResult {
  code: string;
  valid: boolean;
  amount: number;
}

export const normalizePromoCode = (code: string): string => code.trim().toUpperCase();

/** اعتبارسنجی کد تخفیف با منبع تزریق‌شده (بدون هیچ فهرست داخلی). */
export const resolvePromoCode = (rawCode: string, lookupPromo: PromoLookup): PromoCodeResult => {
  const code = normalizePromoCode(rawCode);
  if (!code) return { code, valid: false, amount: 0 };
  const amount = lookupPromo(code);
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { code, valid: false, amount: 0 };
  }
  return { code, valid: true, amount };
};

/** تخفیف سراسری فقط زمانی اعمال می‌شود که نرخ آن در کاتالوگ تعیین شده باشد. */
const calculateGlobalDiscount = (subtotal: number, rate: number | null): number => {
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return 0;
  const rounded = Math.round((subtotal * rate) / 1000) * 1000;
  return Math.min(rounded, subtotal);
};

/**
 * جمع‌زدن قیمت برای انتخابی که خدمت و افزودنی‌هایش از قبل در کاتالوگ یافت شده‌اند.
 * هر دو مسیر (اصلاح‌گر و سخت‌گیرانه) از همین یک تابع استفاده می‌کنند تا محاسبه دو نسخه نداشته باشد.
 */
const sumResolvedSelection = <S extends string>(
  deps: PricingDependencies<S>,
  service: CatalogService<S>,
  hours: number,
  addons: readonly CatalogAddon[],
  hasDetergentPackage: boolean,
  promoCode: string | undefined,
): CorePriceBreakdown<S> => {
  const hourlyRate = service.hourlyRate;
  const serviceBase = hourlyRate * hours;

  const addonLines: PriceLine[] = addons.map((addon) => ({
    id: addon.id,
    title: addon.title,
    amount: addon.price,
  }));
  const addonsTotal = addonLines.reduce((sum, line) => sum + line.amount, 0);

  const detergentCost = hasDetergentPackage ? deps.catalog.detergentPackagePrice : 0;
  const subtotal = serviceBase + addonsTotal + detergentCost;

  const rawDiscountLines: PriceLine[] = [];
  const globalDiscount = calculateGlobalDiscount(subtotal, deps.catalog.onlineBookingDiscountRate);
  if (globalDiscount > 0) {
    rawDiscountLines.push({ id: 'online-booking', title: 'تخفیف رزرو آنلاین', amount: globalDiscount });
  }
  if (promoCode) {
    const promo = resolvePromoCode(promoCode, deps.lookupPromo);
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
  };
};

/**
 * مسیر اصلاح‌گر (برآورد نمایشی) — رفتار پیش از جداسازی هسته را عیناً حفظ می‌کند:
 *   • خدمت ناشناخته با **اولین** خدمت کاتالوگ قیمت‌گذاری می‌شود؛
 *   • افزودنی ناشناخته حذف و افزودنی تکراری یک بار حساب می‌شود؛
 *   • ساعت فقط گرد (به پایین) و حداقل ۱ می‌شود؛ بازهٔ [حداقل خدمت، سقف] اعمال **نمی‌شود**.
 * این مسیر برای ساخت مبلغ معتبر سفارش مناسب نیست؛ سرور از `quoteStrict` استفاده کند.
 */
export const priceSelection = <S extends string>(
  deps: PricingDependencies<S>,
  input: PricingInput<S>,
): CorePriceBreakdown<S> => {
  const { catalog } = deps;
  if (catalog.services.length === 0) {
    throw new Error('کاتالوگ قیمت هیچ خدمتی ندارد.');
  }
  const service = catalog.services.find((item) => item.id === input.serviceId) ?? catalog.services[0];
  const hours = Number.isFinite(input.hours) ? Math.max(1, Math.floor(input.hours)) : 1;

  // حذف خدمات تکراری تا یک قلم دو بار محاسبه نشود.
  const addons = Array.from(new Set(input.addonIds))
    .map((id) => catalog.addons.find((addon) => addon.id === id))
    .filter((addon): addon is CatalogAddon => Boolean(addon));

  return sumResolvedSelection(deps, service, hours, addons, input.hasDetergentPackage, input.promoCode);
};

/* ------------------------------------------------------------------ */
/* مسیر سخت‌گیرانه (برای سرور)                                          */
/* ------------------------------------------------------------------ */

export type PricingIssueCode =
  | 'invalid_input'
  | 'unknown_service'
  | 'hours_out_of_range'
  | 'invalid_addons'
  | 'unknown_addon'
  | 'invalid_detergent_flag'
  | 'invalid_promo_code'
  | 'unknown_promo_code';

export interface PricingIssue {
  code: PricingIssueCode;
  field: 'body' | 'serviceId' | 'hours' | 'addonIds' | 'hasDetergentPackage' | 'promoCode';
  /** برای افزودنی ناشناخته: شناسهٔ همان افزودنی. */
  value?: string;
}

export interface ValidatedSelection<S extends string = string> {
  service: CatalogService<S>;
  hours: number;
  /** بدون تکرار، به ترتیب ورود. */
  addons: CatalogAddon[];
  hasDetergentPackage: boolean;
  /** کد نرمال‌شده؛ `undefined` یعنی بدون کد. */
  promoCode?: string;
}

export type SelectionValidation<S extends string = string> =
  | { ok: true; selection: ValidatedSelection<S> }
  | { ok: false; issues: PricingIssue[] };

const MAX_PROMO_CODE_LENGTH = 64;
const MAX_ADDON_COUNT = 50;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * اعتبارسنجی سخت‌گیرانهٔ ورودیِ نامطمئن (مثلاً بدنهٔ درخواست HTTP).
 * هیچ مقداری را «اصلاح» نمی‌کند؛ هر ورودی خارج از کاتالوگ یا بازه رد می‌شود.
 * فقط قواعدی بررسی می‌شوند که همین حالا در فرم وجود دارند (خدمت و افزودنی از فهرست،
 * ساعت صحیح بین حداقل خدمت و سقف کاتالوگ)؛ قاعدهٔ کسب‌وکاری تازه‌ای اضافه نشده است.
 */
export const validatePricingSelection = <S extends string>(
  deps: PricingDependencies<S>,
  raw: unknown,
): SelectionValidation<S> => {
  if (!isPlainObject(raw)) {
    return { ok: false, issues: [{ code: 'invalid_input', field: 'body' }] };
  }
  const { catalog } = deps;
  const issues: PricingIssue[] = [];

  const service =
    typeof raw.serviceId === 'string'
      ? catalog.services.find((item) => item.id === raw.serviceId)
      : undefined;
  if (!service) issues.push({ code: 'unknown_service', field: 'serviceId' });

  const hours = raw.hours;
  const hoursValid =
    typeof hours === 'number' &&
    Number.isInteger(hours) &&
    service !== undefined &&
    hours >= service.minHours &&
    hours <= catalog.maxHours;
  if (service && !hoursValid) issues.push({ code: 'hours_out_of_range', field: 'hours' });

  const addons: CatalogAddon[] = [];
  if (!Array.isArray(raw.addonIds) || raw.addonIds.length > MAX_ADDON_COUNT) {
    issues.push({ code: 'invalid_addons', field: 'addonIds' });
  } else {
    for (const id of raw.addonIds) {
      if (typeof id !== 'string') {
        issues.push({ code: 'invalid_addons', field: 'addonIds' });
        continue;
      }
      const addon = catalog.addons.find((item) => item.id === id);
      if (!addon) {
        issues.push({ code: 'unknown_addon', field: 'addonIds', value: id.slice(0, 64) });
      } else if (!addons.includes(addon)) {
        addons.push(addon);
      }
    }
  }

  if (typeof raw.hasDetergentPackage !== 'boolean') {
    issues.push({ code: 'invalid_detergent_flag', field: 'hasDetergentPackage' });
  }

  let promoCode: string | undefined;
  if (raw.promoCode !== undefined && raw.promoCode !== null) {
    if (typeof raw.promoCode !== 'string' || raw.promoCode.length > MAX_PROMO_CODE_LENGTH) {
      issues.push({ code: 'invalid_promo_code', field: 'promoCode' });
    } else {
      const normalized = normalizePromoCode(raw.promoCode);
      if (normalized) {
        if (!resolvePromoCode(normalized, deps.lookupPromo).valid) {
          issues.push({ code: 'unknown_promo_code', field: 'promoCode' });
        } else {
          promoCode = normalized;
        }
      }
    }
  }

  if (issues.length > 0 || !service) return { ok: false, issues };
  return {
    ok: true,
    selection: {
      service,
      hours: hours as number,
      addons,
      hasDetergentPackage: raw.hasDetergentPackage as boolean,
      promoCode,
    },
  };
};

export type StrictQuoteResult<S extends string = string> =
  | { ok: true; breakdown: CorePriceBreakdown<S> }
  | { ok: false; issues: PricingIssue[] };

/** قیمت معتبر فقط برای ورودی‌ای که اعتبارسنجی سخت‌گیرانه را گذرانده باشد. */
export const quoteStrict = <S extends string>(
  deps: PricingDependencies<S>,
  raw: unknown,
): StrictQuoteResult<S> => {
  const validation = validatePricingSelection(deps, raw);
  if (!validation.ok) return validation;
  const { service, hours, addons, hasDetergentPackage, promoCode } = validation.selection;
  return {
    ok: true,
    breakdown: sumResolvedSelection(deps, service, hours, addons, hasDetergentPackage, promoCode),
  };
};
