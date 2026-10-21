import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  priceSelection,
  quoteStrict,
  resolvePromoCode,
  validatePricingSelection,
  type PricingDependencies,
} from './pricingCore';

/**
 * هستهٔ قیمت باید بدون دادهٔ نمایشی کار کند. اگر هسته (یا هر چیزی که import می‌کند)
 * به mockData یا تنظیمات نمایشی دست بزند، همین mock ها بارگذاری این فایل را شکست می‌دهند.
 */
vi.mock('../data/mockData', () => {
  throw new Error('هستهٔ قیمت نباید mockData را بارگذاری کند.');
});
vi.mock('../config/capabilities', () => {
  throw new Error('هستهٔ قیمت نباید تنظیمات نسخهٔ نمایشی را بارگذاری کند.');
});

type TestServiceId = 'flat' | 'villa';

/** کاتالوگی کاملاً متفاوت از دادهٔ نمونهٔ سایت (شناسه، نرخ، سقف و کدها). */
const SERVER_LIKE_DEPS: PricingDependencies<TestServiceId> = {
  catalog: {
    services: [
      { id: 'flat', title: 'آپارتمان', hourlyRate: 100_000, minHours: 2 },
      { id: 'villa', title: 'ویلا', hourlyRate: 250_000, minHours: 6 },
    ],
    addons: [
      { id: 'fridge', title: 'یخچال', price: 70_000 },
      { id: 'oven', title: 'فر', price: 90_000 },
    ],
    detergentPackagePrice: 50_000,
    onlineBookingDiscountRate: null,
    maxHours: 10,
  },
  lookupPromo: (code) => (code === 'SERVER10' ? 10_000 : undefined),
};

const validBody = {
  serviceId: 'flat',
  hours: 3,
  addonIds: ['fridge'],
  hasDetergentPackage: true,
};

describe('هستهٔ قیمت — مستقل از mockData', () => {
  it('در کد هسته فقط import نوع (type) وجود دارد؛ هیچ داده یا تنظیماتی import نمی‌شود', () => {
    const source = readFileSync(new URL('./pricingCore.ts', import.meta.url), 'utf8');
    const imports = source.split('\n').filter((line) => /^\s*import\s/.test(line));
    expect(imports.filter((line) => !/^\s*import\s+type\s/.test(line))).toEqual([]);
    // توضیحات کد کنار گذاشته می‌شوند؛ فقط خود کد نباید به فهرست یا دادهٔ نمونه اشاره کند.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/DISCOUNT_CODES|PAK1403|NEWCUSTOMER|OFFER20|mockData|capabilities/);
  });

  it('با کاتالوگ و کد تخفیف تزریق‌شده محاسبه می‌کند', () => {
    const result = priceSelection(SERVER_LIKE_DEPS, {
      serviceId: 'villa',
      hours: 7,
      addonIds: ['fridge', 'oven'],
      hasDetergentPackage: true,
      promoCode: ' server10 ',
    });
    expect(result.serviceBase).toBe(7 * 250_000);
    expect(result.addonsTotal).toBe(160_000);
    expect(result.detergentCost).toBe(50_000);
    expect(result.subtotal).toBe(1_960_000);
    expect(result.discountLines).toEqual([{ id: 'promo:SERVER10', title: 'کد تخفیف SERVER10', amount: 10_000 }]);
    expect(result.total).toBe(1_950_000);
  });

  it('کدهای تخفیف نمونهٔ سایت را نمی‌شناسد مگر منبع تزریق‌شده آن‌ها را بدهد', () => {
    expect(resolvePromoCode('PAK1403', SERVER_LIKE_DEPS.lookupPromo).valid).toBe(false);
    const result = priceSelection(SERVER_LIKE_DEPS, { ...validBody, serviceId: 'flat', promoCode: 'PAK1403' });
    expect(result.discountsTotal).toBe(0);
  });

  it('تخفیف سراسری را از کاتالوگ می‌خواند و از جمع اقلام بیشتر نمی‌کند', () => {
    const deps: PricingDependencies<TestServiceId> = {
      ...SERVER_LIKE_DEPS,
      catalog: { ...SERVER_LIKE_DEPS.catalog, onlineBookingDiscountRate: 0.05 },
    };
    const result = priceSelection(deps, { serviceId: 'flat', hours: 2, addonIds: [], hasDetergentPackage: false });
    expect(result.subtotal).toBe(200_000);
    expect(result.discountLines).toEqual([{ id: 'online-booking', title: 'تخفیف رزرو آنلاین', amount: 10_000 }]);
    expect(result.total).toBe(190_000);
  });

  it('کاتالوگ خالی را با خطای روشن رد می‌کند', () => {
    const deps = { ...SERVER_LIKE_DEPS, catalog: { ...SERVER_LIKE_DEPS.catalog, services: [] } };
    expect(() =>
      priceSelection(deps, { serviceId: 'flat', hours: 2, addonIds: [], hasDetergentPackage: false }),
    ).toThrow(/هیچ خدمتی/);
  });
});

describe('هستهٔ قیمت — اعتبارسنجی سخت‌گیرانه برای سرور', () => {
  it('ورودی معتبر را می‌پذیرد، افزودنی تکراری را یک بار و کد را نرمال‌شده نگه می‌دارد', () => {
    const result = validatePricingSelection(SERVER_LIKE_DEPS, {
      ...validBody,
      addonIds: ['fridge', 'fridge', 'oven'],
      promoCode: ' server10 ',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selection.service.id).toBe('flat');
    expect(result.selection.addons.map((addon) => addon.id)).toEqual(['fridge', 'oven']);
    expect(result.selection.promoCode).toBe('SERVER10');
  });

  it.each([
    ['بدنهٔ غیرشیء', null, 'invalid_input'],
    ['بدنهٔ آرایه', [], 'invalid_input'],
    ['خدمت ناشناخته', { ...validBody, serviceId: 'home-standard' }, 'unknown_service'],
    ['خدمت غیررشته', { ...validBody, serviceId: 1 }, 'unknown_service'],
    ['ساعت کمتر از حداقل خدمت', { ...validBody, hours: 1 }, 'hours_out_of_range'],
    ['ساعت بیشتر از سقف', { ...validBody, hours: 11 }, 'hours_out_of_range'],
    ['ساعت اعشاری', { ...validBody, hours: 2.5 }, 'hours_out_of_range'],
    ['ساعت رشته‌ای', { ...validBody, hours: '3' }, 'hours_out_of_range'],
    ['ساعت NaN', { ...validBody, hours: Number.NaN }, 'hours_out_of_range'],
    ['افزودنی غیرآرایه', { ...validBody, addonIds: 'fridge' }, 'invalid_addons'],
    ['افزودنی غیررشته', { ...validBody, addonIds: [42] }, 'invalid_addons'],
    ['افزودنی ناشناخته', { ...validBody, addonIds: ['walls'] }, 'unknown_addon'],
    ['پرچم شوینده غیربولی', { ...validBody, hasDetergentPackage: 'yes' }, 'invalid_detergent_flag'],
    ['کد تخفیف غیررشته', { ...validBody, promoCode: 5 }, 'invalid_promo_code'],
    ['کد تخفیف بیش از حد بلند', { ...validBody, promoCode: 'X'.repeat(65) }, 'invalid_promo_code'],
    ['کد تخفیف ناشناخته', { ...validBody, promoCode: 'PAK1403' }, 'unknown_promo_code'],
  ])('%s را رد می‌کند و چیزی را «اصلاح» نمی‌کند', (_name, body, code) => {
    const result = quoteStrict(SERVER_LIKE_DEPS, body);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain(code);
  });

  it('افزودنی ناشناخته را با شناسهٔ کوتاه‌شده گزارش می‌کند', () => {
    const result = validatePricingSelection(SERVER_LIKE_DEPS, { ...validBody, addonIds: ['z'.repeat(200)] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toEqual({ code: 'unknown_addon', field: 'addonIds', value: 'z'.repeat(64) });
  });

  it('کد تخفیف خالی یا null را «بدون کد» می‌داند', () => {
    for (const promoCode of ['', '   ', null, undefined]) {
      const result = quoteStrict(SERVER_LIKE_DEPS, { ...validBody, promoCode });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.breakdown.discountsTotal).toBe(0);
    }
  });

  it('مبلغ، تخفیف یا وضعیتی که مشتری بفرستد هیچ اثری روی قیمت ندارد', () => {
    const honest = quoteStrict(SERVER_LIKE_DEPS, validBody);
    const tampered = quoteStrict(SERVER_LIKE_DEPS, {
      ...validBody,
      total: 1,
      totalPrice: 1,
      discountsTotal: 999_999,
      hourlyRate: 1,
      status: 'completed',
    });
    expect(honest.ok && tampered.ok).toBe(true);
    if (!honest.ok || !tampered.ok) return;
    expect(tampered.breakdown).toEqual(honest.breakdown);
    // ۳ × ۱۰۰٬۰۰۰ + یخچال ۷۰٬۰۰۰ + شوینده ۵۰٬۰۰۰
    expect(honest.breakdown.total).toBe(420_000);
  });

  it('برخلاف مسیر نمایشی، خدمت ناشناخته را به اولین خدمت تبدیل نمی‌کند', () => {
    const body = { serviceId: 'ghost', hours: 3, addonIds: [], hasDetergentPackage: false };
    expect(priceSelection(SERVER_LIKE_DEPS, body as never).serviceId).toBe('flat');
    expect(quoteStrict(SERVER_LIKE_DEPS, body).ok).toBe(false);
  });
});
