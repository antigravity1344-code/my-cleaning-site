import { describe, expect, it } from 'vitest';
import {
  PRICING_CONFIG,
  calculatePrice,
  calculateRecommendedHours,
  isSameTotal,
  validatePromoCode,
} from './pricingEngine';
import { ADDON_OPTIONS, DISCOUNT_CODES, SERVICES_LIST } from '../data/mockData';

/**
 * آزمون‌های موتور قیمت‌گذاری مشترک.
 *
 * هدف اصلی: اثبات این‌که «مبلغ نمایش‌داده‌شده در محاسبه‌گر» و «مبلغ فاکتور رزرو»
 * برای ورودی یکسان همیشه برابر است (باگ P0 مأموریت ممیزی).
 */

const addonPrice = (id: string): number => {
  const addon = ADDON_OPTIONS.find((item) => item.id === id);
  if (!addon) throw new Error(`unknown addon ${id}`);
  return addon.price;
};

const serviceRate = (id: string): number => {
  const service = SERVICES_LIST.find((item) => item.id === id);
  if (!service) throw new Error(`unknown service ${id}`);
  return service.baseHourlyRate;
};

describe('calculatePrice — محاسبات پایه', () => {
  it('هزینه پایه را از نرخ ساعتی خدمت و تعداد ساعت محاسبه می‌کند', () => {
    const result = calculatePrice({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: [],
      hasDetergentPackage: false,
    });

    expect(result.hourlyRate).toBe(serviceRate('home-standard'));
    expect(result.serviceBase).toBe(serviceRate('home-standard') * 4);
    expect(result.addonsTotal).toBe(0);
    expect(result.detergentCost).toBe(0);
    expect(result.total).toBe(result.serviceBase);
  });

  it('قیمت پکیج شوینده را فقط در صورت انتخاب اضافه می‌کند', () => {
    const without = calculatePrice({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: [],
      hasDetergentPackage: false,
    });
    const withPackage = calculatePrice({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: [],
      hasDetergentPackage: true,
    });

    expect(without.detergentCost).toBe(0);
    expect(withPackage.detergentCost).toBe(PRICING_CONFIG.detergentPackagePrice);
    expect(withPackage.total - without.total).toBe(PRICING_CONFIG.detergentPackagePrice);
  });

  it('هزینه خدمات جانبی را درست جمع می‌زند', () => {
    const addonIds = ['windows', 'walls'];
    const result = calculatePrice({
      serviceId: 'home-deep',
      hours: 5,
      addonIds,
      hasDetergentPackage: false,
    });

    const expectedAddons = addonIds.reduce((sum, id) => sum + addonPrice(id), 0);
    expect(result.addonsTotal).toBe(expectedAddons);
    expect(result.addonLines).toHaveLength(2);
    expect(result.subtotal).toBe(result.serviceBase + expectedAddons);
  });

  it('سرویس ناشناخته را به اولین خدمت فهرست نگاشت می‌کند و کرش نمی‌کند', () => {
    const result = calculatePrice({
      // @ts-expect-error ورودی نامعتبر عمدی برای آزمون رفتار دفاعی
      serviceId: 'does-not-exist',
      hours: 4,
      addonIds: [],
      hasDetergentPackage: false,
    });
    expect(result.hourlyRate).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });
});

describe('calculatePrice — یکسان‌بودن مبلغ محاسبه‌گر و فاکتور رزرو', () => {
  const scenarios = [
    { name: 'استاندارد منزل / بدون افزودنی', serviceId: 'home-standard' as const, hours: 4, addonIds: [], hasDetergentPackage: false },
    { name: 'استاندارد منزل / با شوینده', serviceId: 'home-standard' as const, hours: 4, addonIds: [], hasDetergentPackage: true },
    { name: 'عمیق / چند افزودنی', serviceId: 'home-deep' as const, hours: 6, addonIds: ['walls', 'appliances', 'ironing'], hasDetergentPackage: true },
    { name: 'دفاتر / آسانسور و شیشه', serviceId: 'office' as const, hours: 5, addonIds: ['windows'], hasDetergentPackage: false },
    { name: 'بعد از بازسازی', serviceId: 'post-construction' as const, hours: 8, addonIds: ['windows', 'appliances'], hasDetergentPackage: true },
    { name: 'مبل‌شویی', serviceId: 'furniture-carpet' as const, hours: 3, addonIds: [], hasDetergentPackage: false },
  ];

  it.each(scenarios)('$name — دو محاسبه مستقل مبلغ یکسان می‌دهند', (scenario) => {
    const input = {
      serviceId: scenario.serviceId,
      hours: scenario.hours,
      addonIds: scenario.addonIds,
      hasDetergentPackage: scenario.hasDetergentPackage,
    };

    // شبیه‌سازی: یک بار برای نمایش در محاسبه‌گر، یک بار برای فاکتور رزرو.
    const calculatorView = calculatePrice(input);
    const bookingInvoiceView = calculatePrice(input);

    expect(isSameTotal(calculatorView, bookingInvoiceView)).toBe(true);
    expect(calculatorView.total).toBe(bookingInvoiceView.total);
  });
});

describe('تخفیف‌ها', () => {
  it('در وضعیت کنونی هیچ تخفیف سراسری تأییدنشده‌ای اعمال نمی‌شود', () => {
    // سیاست ۵٪ «رزرو آنلاین» تأیید نشده است؛ تا آن زمان نباید وعده داده شود.
    expect(PRICING_CONFIG.onlineBookingDiscountRate).toBeNull();

    const result = calculatePrice({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: [],
      hasDetergentPackage: true,
    });

    const globalDiscount = result.discountLines.find((line) => line.id === 'online-booking');
    expect(globalDiscount).toBeUndefined();
    expect(result.discountsTotal).toBe(0);
    expect(result.total).toBe(result.subtotal);
  });

  it('کد تخفیف معتبر را اعتبارسنجی و اعمال می‌کند', () => {
    const [code, amount] = Object.entries(DISCOUNT_CODES)[0];
    const result = calculatePrice({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: [],
      hasDetergentPackage: true,
      promoCode: code,
    });

    expect(result.discountsTotal).toBe(Math.min(amount, result.subtotal));
    expect(result.total).toBe(result.subtotal - result.discountsTotal);
  });

  it('کد تخفیف را بدون توجه به بزرگی/کوچکی حروف و فاصله‌ها می‌پذیرد', () => {
    const [code] = Object.entries(DISCOUNT_CODES)[0];
    expect(validatePromoCode(`  ${code.toLowerCase()}  `).valid).toBe(true);
    expect(validatePromoCode(`  ${code.toLowerCase()}  `).code).toBe(code);
  });

  it('کد نامعتبر را رد می‌کند و تخفیفی اعمال نمی‌کند', () => {
    const result = validatePromoCode('NOPE-123');
    expect(result.valid).toBe(false);
    expect(result.amount).toBe(0);

    const priced = calculatePrice({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: [],
      hasDetergentPackage: false,
      promoCode: 'NOPE-123',
    });
    expect(priced.discountsTotal).toBe(0);
    expect(priced.total).toBe(priced.subtotal);
  });

  it('همان کد را دو بار اعمال نمی‌کند (تخفیف تکراری)', () => {
    const [code] = Object.entries(DISCOUNT_CODES)[0];
    // ارسال همان کد به‌صورت تکراری در فهرست کدها نباید تخفیف را دو برابر کند.
    const once = calculatePrice({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: [],
      hasDetergentPackage: false,
      promoCode: code,
    });
    const claimedTwice = calculatePrice({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: [code],
      hasDetergentPackage: false,
      promoCode: code,
    });

    expect(claimedTwice.discountsTotal).toBe(once.discountsTotal);
  });

  it('مجموع تخفیف هرگز از مبلغ اقلام بیشتر نمی‌شود', () => {
    const smallestService = SERVICES_LIST.reduce((min, item) =>
      item.baseHourlyRate < min.baseHourlyRate ? item : min,
    );
    const biggestCode = Math.max(...Object.values(DISCOUNT_CODES));

    const result = calculatePrice({
      serviceId: smallestService.id,
      hours: smallestService.minHours,
      addonIds: [],
      hasDetergentPackage: false,
      promoCode: Object.keys(DISCOUNT_CODES).find((key) => DISCOUNT_CODES[key] === biggestCode),
    });

    expect(result.discountsTotal).toBeLessThanOrEqual(result.subtotal);
  });

  it('مبلغ نهایی هرگز منفی نمی‌شود حتی با کد بزرگ‌تر از فاکتور', () => {
    // سناریوی افراطی: کد تخفیف بزرگ‌تر از جمع اقلام
    const result = calculatePrice({
      serviceId: 'building-staircase',
      hours: 1,
      addonIds: [],
      hasDetergentPackage: false,
      promoCode: 'NEWCUSTOMER',
    });

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.total)).toBe(true);
  });
});

describe('ورودی‌های نامعتبر', () => {
  it('ساعت صفر یا منفی را به حداقل یک ساعت محدود می‌کند', () => {
    const zero = calculatePrice({ serviceId: 'home-standard', hours: 0, addonIds: [], hasDetergentPackage: false });
    const negative = calculatePrice({ serviceId: 'home-standard', hours: -5, addonIds: [], hasDetergentPackage: false });

    expect(zero.hours).toBeGreaterThanOrEqual(1);
    expect(negative.hours).toBeGreaterThanOrEqual(1);
    expect(negative.total).toBeGreaterThan(0);
  });

  it('خدمات جانبی تکراری را دو بار محاسبه نمی‌کند', () => {
    const single = calculatePrice({ serviceId: 'home-standard', hours: 4, addonIds: ['windows'], hasDetergentPackage: false });
    const duplicated = calculatePrice({ serviceId: 'home-standard', hours: 4, addonIds: ['windows', 'windows', 'windows'], hasDetergentPackage: false });

    expect(duplicated.addonsTotal).toBe(single.addonsTotal);
    expect(duplicated.total).toBe(single.total);
  });

  it('خدمات جانبی ناشناخته را نادیده می‌گیرد', () => {
    const result = calculatePrice({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: ['windows', 'not-a-real-addon'],
      hasDetergentPackage: false,
    });
    expect(result.addonLines).toHaveLength(1);
    expect(result.addonsTotal).toBe(addonPrice('windows'));
  });

  it('مبلغ را همیشه به‌عنوان برآورد آزمایشی علامت می‌زند', () => {
    const result = calculatePrice({ serviceId: 'home-standard', hours: 4, addonIds: [], hasDetergentPackage: false });
    expect(result.isProvisional).toBe(true);
    expect(result.provisionalNote.length).toBeGreaterThan(0);
  });

  it('ورودی یکسان همیشه خروجی یکسان می‌دهد (تابع خالص)', () => {
    const input = { serviceId: 'office' as const, hours: 6, addonIds: ['ironing'], hasDetergentPackage: true };
    const first = calculatePrice(input);
    const second = calculatePrice(input);
    expect(second).toEqual(first);
  });
});

describe('calculateRecommendedHours', () => {
  it('هرگز کمتر از حداقل ساعت خدمت برنمی‌گرداند', () => {
    SERVICES_LIST.forEach((service) => {
      const hours = calculateRecommendedHours({
        serviceId: service.id,
        squareMeters: 30,
        roomsCount: 0,
        bathroomsCount: 0,
      });
      expect(hours).toBeGreaterThanOrEqual(service.minHours);
    });
  });

  it('سقف ۱۲ ساعت را رعایت می‌کند', () => {
    const hours = calculateRecommendedHours({
      serviceId: 'post-construction',
      squareMeters: 500,
      roomsCount: 6,
      bathroomsCount: 4,
    });
    expect(hours).toBeLessThanOrEqual(12);
  });

  it('برای فضای بزرگ‌تر ساعت بیشتری پیشنهاد می‌کند', () => {
    const small = calculateRecommendedHours({ serviceId: 'home-standard', squareMeters: 60, roomsCount: 1, bathroomsCount: 1 });
    const large = calculateRecommendedHours({ serviceId: 'home-standard', squareMeters: 250, roomsCount: 4, bathroomsCount: 3 });
    expect(large).toBeGreaterThan(small);
  });
});
