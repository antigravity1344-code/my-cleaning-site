import { describe, expect, it } from 'vitest';
import type { ServiceType } from '../types';
import {
  DEMO_PRICING_CATALOG,
  DEMO_PRICING_DEPENDENCIES,
  calculatePrice,
  validatePromoCode,
  type PricingInput,
} from './pricingEngine';
import { quoteStrict } from './pricingCore';
import {
  calculatePrice as referenceCalculatePrice,
  validatePromoCode as referenceValidatePromoCode,
} from './__reference__/pricingEngine.cda69a9';

/**
 * آزمون مقایسه‌ای: موتور جدید (هستهٔ مستقل + کاتالوگ نمایشی) باید برای هر ورودی دقیقاً
 * همان خروجی موتور پیش از جداسازی (`main` `cda69a9`) را بدهد؛ از جمله برای ورودی‌های
 * نامعتبری که مسیر اصلاح‌گر آن‌ها را اصلاح می‌کند.
 */

const SERVICE_IDS = [
  ...DEMO_PRICING_CATALOG.services.map((service) => service.id),
  'does-not-exist',
  '',
] as ServiceType[];

const HOURS = [-5, 0, 0.5, 1, 2.7, 3, 4, 5, 6, 8, 12, 13, 100, Number.NaN, Infinity, -Infinity];

const ADDON_SETS: string[][] = [
  [],
  ['walls'],
  ['windows', 'appliances'],
  ['walls', 'windows', 'appliances', 'ironing'],
  ['detergents'],
  ['walls', 'walls'],
  ['unknown'],
  ['ironing', 'unknown', 'ironing', 'detergents'],
];

const PROMO_CODES: (string | undefined)[] = [
  undefined,
  '',
  'PAK1403',
  ' newcustomer ',
  'offer20',
  'BAD',
  'constructor',
  '__proto__',
  'hasOwnProperty',
];

const allInputs = (): PricingInput[] => {
  const inputs: PricingInput[] = [];
  for (const serviceId of SERVICE_IDS) {
    for (const hours of HOURS) {
      for (const addonIds of ADDON_SETS) {
        for (const hasDetergentPackage of [false, true]) {
          for (const promoCode of PROMO_CODES) {
            inputs.push({ serviceId, hours, addonIds, hasDetergentPackage, promoCode });
          }
        }
      }
    }
  }
  return inputs;
};

describe('هستهٔ قیمت — حفظ دقیق رفتار و مبالغ نسخهٔ نمایشی', () => {
  it('برای همهٔ ترکیب‌های ماتریس، خروجی با موتور پیش از جداسازی یکسان است', () => {
    const inputs = allInputs();
    expect(inputs.length).toBeGreaterThan(18_000);

    const mismatches: string[] = [];
    for (const input of inputs) {
      const actual = calculatePrice(input);
      const expected = referenceCalculatePrice(input);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatches.push(JSON.stringify(input));
        if (mismatches.length >= 5) break;
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('اعتبارسنجی کد تخفیف نمایشی همان نتیجهٔ قبلی را می‌دهد', () => {
    for (const code of PROMO_CODES) {
      const raw = code ?? '';
      expect(validatePromoCode(raw)).toEqual(referenceValidatePromoCode(raw));
    }
  });

  it('مبالغ نمونهٔ فعلی (قابل محاسبه با دست) تغییر نکرده‌اند', () => {
    // نظافت استاندارد: ۴ × ۱۶۰٬۰۰۰ + بستهٔ شوینده ۱۴۰٬۰۰۰
    expect(calculatePrice({ serviceId: 'home-standard', hours: 4, addonIds: [], hasDetergentPackage: true }).total)
      .toBe(780_000);
    expect(
      calculatePrice({ serviceId: 'home-standard', hours: 4, addonIds: [], hasDetergentPackage: true, promoCode: 'PAK1403' })
        .total,
    ).toBe(680_000);

    // خانه‌تکانی: ۶ × ۱۹۰٬۰۰۰ + دیوار ۱۸۰٬۰۰۰ + لوازم ۱۵۰٬۰۰۰ + اتو ۱۱۰٬۰۰۰ + شوینده ۱۴۰٬۰۰۰
    const deep = calculatePrice({
      serviceId: 'home-deep',
      hours: 6,
      addonIds: ['walls', 'appliances', 'ironing'],
      hasDetergentPackage: true,
      promoCode: 'NEWCUSTOMER',
    });
    expect(deep.subtotal).toBe(1_720_000);
    expect(deep.discountsTotal).toBe(150_000);
    expect(deep.total).toBe(1_570_000);

    // دفاتر: ۵ × ۱۷۵٬۰۰۰ + شیشه ۱۳۰٬۰۰۰ − کد ۸۰٬۰۰۰
    expect(
      calculatePrice({ serviceId: 'office', hours: 5, addonIds: ['windows'], hasDetergentPackage: false, promoCode: 'OFFER20' })
        .total,
    ).toBe(925_000);
  });

  it('برای ورودی معتبر، مسیر سخت‌گیرانهٔ سرور همان مبلغ مسیر نمایشی را می‌دهد', () => {
    let checked = 0;
    for (const service of DEMO_PRICING_CATALOG.services) {
      for (let hours = service.minHours; hours <= DEMO_PRICING_CATALOG.maxHours; hours += 1) {
        for (const addonIds of [[], ['walls'], ['windows', 'appliances', 'ironing']]) {
          for (const hasDetergentPackage of [false, true]) {
            for (const promoCode of [undefined, 'PAK1403', 'offer20']) {
              const input = { serviceId: service.id, hours, addonIds, hasDetergentPackage, promoCode };
              const strict = quoteStrict(DEMO_PRICING_DEPENDENCIES, input);
              if (!strict.ok) throw new Error(`ورودی معتبر رد شد: ${JSON.stringify(input)}`);
              const { isProvisional: _p, provisionalNote: _n, ...lenient } = calculatePrice(input);
              expect(strict.breakdown).toEqual(lenient);
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});
