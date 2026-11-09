import {
  ADDONS,
  DETERGENT_PACKAGE_PRICE,
  DISCOUNT_CODES,
  MAX_HOURS,
  ONLINE_BOOKING_DISCOUNT_RATE,
  findAddon,
  findService,
} from './pricingConfig.js';

/**
 * موتور قیمت سمت سرور — نسخهٔ سخت‌گیر، نه نسخهٔ مرورگر.
 *
 * طبق سند عملیاتی (بخش ۴ و ۱۲.۵): موتور مرورگر (`src/pricing/pricingEngine.ts`)
 * ورودی نامعتبر را به‌جای رد کردن، بی‌صدا اصلاح می‌کند (خدمت ناشناخته →
 * اولین خدمت فهرست، ساعت نامعتبر → گرد به پایین). این رفتار در مرورگر بی‌خطر
 * است چون چیزی ذخیره یا پرداخت نمی‌شود، ولی همین رفتار روی سرور خطرناک است:
 * یک درخواست دست‌کاری‌شده (ساعت ۱۰۰ یا خدمت ساختگی) یک سفارش «معتبر» با مبلغ
 * دیگر می‌سازد. به همین دلیل این فایل یک کپی مستقل و سخت‌گیر است، نه فراخوانی
 * دوبارهٔ موتور مرورگر.
 *
 * هر تابعی که این ماژول صادر می‌کند یا مقدار معتبر برمی‌گرداند یا یک خطای
 * {field, message} پرتاب می‌کند؛ هیچ ورودی نامعتبری بی‌صدا اصلاح نمی‌شود.
 */

export class QuoteValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'QuoteValidationError';
    this.field = field;
  }
}

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

/**
 * اعتبارسنجی و نرمال‌سازی ورودی خام یک پیش‌فاکتور/سفارش.
 * در صورت نامعتبر بودن، QuoteValidationError پرتاب می‌کند (نه اصلاح بی‌صدا).
 */
export const validateQuoteInput = (rawInput) => {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new QuoteValidationError('body', 'بدنهٔ درخواست نامعتبر است.');
  }
  const { serviceId, hours, addonIds, hasDetergentPackage, promoCode } = rawInput;

  const service = typeof serviceId === 'string' ? findService(serviceId) : null;
  if (!service) {
    throw new QuoteValidationError('serviceId', 'خدمت انتخاب‌شده نامعتبر است.');
  }

  if (!isPositiveInteger(hours) || hours < service.minHours || hours > MAX_HOURS) {
    throw new QuoteValidationError(
      'hours',
      `تعداد ساعت باید عددی صحیح بین ${service.minHours} و ${MAX_HOURS} باشد.`
    );
  }

  if (addonIds !== undefined) {
    if (!Array.isArray(addonIds) || addonIds.some((id) => typeof id !== 'string')) {
      throw new QuoteValidationError('addonIds', 'فهرست افزودنی‌ها نامعتبر است.');
    }
    const unknown = addonIds.find((id) => !findAddon(id));
    if (unknown) {
      throw new QuoteValidationError('addonIds', `افزودنی ناشناخته: ${unknown}`);
    }
  }

  if (hasDetergentPackage !== undefined && typeof hasDetergentPackage !== 'boolean') {
    throw new QuoteValidationError('hasDetergentPackage', 'مقدار پکیج شوینده باید true یا false باشد.');
  }

  let normalizedPromoCode;
  if (promoCode !== undefined && promoCode !== null && promoCode !== '') {
    if (typeof promoCode !== 'string') {
      throw new QuoteValidationError('promoCode', 'کد تخفیف نامعتبر است.');
    }
    normalizedPromoCode = promoCode.trim().toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(DISCOUNT_CODES, normalizedPromoCode)) {
      throw new QuoteValidationError('promoCode', 'کد تخفیف نامعتبر یا منقضی است.');
    }
  }

  return {
    serviceId: service.id,
    hours,
    addonIds: Array.isArray(addonIds) ? Array.from(new Set(addonIds)) : [],
    hasDetergentPackage: Boolean(hasDetergentPackage),
    promoCode: normalizedPromoCode,
  };
};

/** تخفیف سراسری فقط زمانی اعمال می‌شود که سیاست آن تأیید شده باشد (فعلاً null). */
const calculateGlobalDiscount = (subtotal) => {
  const rate = ONLINE_BOOKING_DISCOUNT_RATE;
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return 0;
  const rounded = Math.round((subtotal * rate) / 1000) * 1000;
  return Math.min(rounded, subtotal);
};

/**
 * محاسبهٔ قیمت معتبر سمت سرور از روی ورودی ازپیش‌اعتبارسنجی‌شده
 * (خروجی `validateQuoteInput`). همان فرمول موتور مرورگر، با دادهٔ سرور.
 */
export const calculateServerPrice = (validatedInput) => {
  const service = findService(validatedInput.serviceId);
  const hourlyRate = service.baseHourlyRate;
  const serviceBase = hourlyRate * validatedInput.hours;

  const addonLines = validatedInput.addonIds
    .map((id) => findAddon(id))
    .map((addon) => ({ id: addon.id, title: addon.title, amount: addon.price }));
  const addonsTotal = addonLines.reduce((sum, line) => sum + line.amount, 0);

  const detergentCost = validatedInput.hasDetergentPackage ? DETERGENT_PACKAGE_PRICE : 0;
  const subtotal = serviceBase + addonsTotal + detergentCost;

  const rawDiscountLines = [];
  const globalDiscount = calculateGlobalDiscount(subtotal);
  if (globalDiscount > 0) {
    rawDiscountLines.push({ id: 'online-booking', title: 'تخفیف رزرو آنلاین', amount: globalDiscount });
  }
  if (validatedInput.promoCode) {
    const amount = DISCOUNT_CODES[validatedInput.promoCode];
    rawDiscountLines.push({ id: `promo:${validatedInput.promoCode}`, title: `کد تخفیف ${validatedInput.promoCode}`, amount });
  }

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
    hours: validatedInput.hours,
    hourlyRate,
    serviceBase,
    addonLines,
    addonsTotal,
    detergentCost,
    subtotal,
    discountLines,
    discountsTotal,
    total,
    pricingVersion: 'v1-demo-data',
  };
};
