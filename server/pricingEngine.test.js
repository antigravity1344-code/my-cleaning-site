import { describe, expect, it } from 'vitest';
import { calculateServerPrice, QuoteValidationError, validateQuoteInput } from './pricingEngine.js';

describe('validateQuoteInput', () => {
  it('پذیرش ورودی معتبر حداقلی', () => {
    const result = validateQuoteInput({ serviceId: 'home-standard', hours: 4 });
    expect(result).toEqual({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: [],
      hasDetergentPackage: false,
      promoCode: undefined,
    });
  });

  it('رد بدنهٔ غیرشیءای', () => {
    expect(() => validateQuoteInput(null)).toThrow(QuoteValidationError);
    expect(() => validateQuoteInput('x')).toThrow(QuoteValidationError);
  });

  it('رد خدمت ناشناخته (نه اصلاح بی‌صدا)', () => {
    try {
      validateQuoteInput({ serviceId: 'does-not-exist', hours: 4 });
      throw new Error('باید پرتاب می‌شد');
    } catch (error) {
      expect(error).toBeInstanceOf(QuoteValidationError);
      expect(error.field).toBe('serviceId');
    }
  });

  it('رد ساعت کمتر از حداقل خدمت', () => {
    expect(() => validateQuoteInput({ serviceId: 'home-standard', hours: 1 })).toThrow(QuoteValidationError);
  });

  it('رد ساعت بیشتر از سقف', () => {
    expect(() => validateQuoteInput({ serviceId: 'home-standard', hours: 100 })).toThrow(QuoteValidationError);
  });

  it('رد ساعت غیر صحیح', () => {
    expect(() => validateQuoteInput({ serviceId: 'home-standard', hours: 4.5 })).toThrow(QuoteValidationError);
  });

  it('رد افزودنی ناشناخته', () => {
    try {
      validateQuoteInput({ serviceId: 'home-standard', hours: 4, addonIds: ['windows', 'ghost'] });
      throw new Error('باید پرتاب می‌شد');
    } catch (error) {
      expect(error).toBeInstanceOf(QuoteValidationError);
      expect(error.field).toBe('addonIds');
    }
  });

  it('حذف افزودنی‌های تکراری', () => {
    const result = validateQuoteInput({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: ['windows', 'windows', 'ironing'],
    });
    expect(result.addonIds).toEqual(['windows', 'ironing']);
  });

  it('رد hasDetergentPackage غیر بولین', () => {
    expect(() =>
      validateQuoteInput({ serviceId: 'home-standard', hours: 4, hasDetergentPackage: 'yes' })
    ).toThrow(QuoteValidationError);
  });

  it('رد کد تخفیف نامعتبر', () => {
    try {
      validateQuoteInput({ serviceId: 'home-standard', hours: 4, promoCode: 'NOT-REAL' });
      throw new Error('باید پرتاب می‌شد');
    } catch (error) {
      expect(error).toBeInstanceOf(QuoteValidationError);
      expect(error.field).toBe('promoCode');
    }
  });

  it('نرمال‌سازی کد تخفیف معتبر (حروف کوچک/فاصله)', () => {
    const result = validateQuoteInput({ serviceId: 'home-standard', hours: 4, promoCode: '  pak1403 ' });
    expect(result.promoCode).toBe('PAK1403');
  });

  it('کد تخفیف خالی یعنی بدون کد', () => {
    const result = validateQuoteInput({ serviceId: 'home-standard', hours: 4, promoCode: '' });
    expect(result.promoCode).toBeUndefined();
  });
});

describe('calculateServerPrice', () => {
  it('محاسبهٔ پایه بدون افزودنی/تخفیف', () => {
    const validated = validateQuoteInput({ serviceId: 'home-standard', hours: 4 });
    const priced = calculateServerPrice(validated);
    expect(priced.serviceBase).toBe(160000 * 4);
    expect(priced.addonsTotal).toBe(0);
    expect(priced.detergentCost).toBe(0);
    expect(priced.discountsTotal).toBe(0);
    expect(priced.total).toBe(priced.serviceBase);
    expect(priced.pricingVersion).toBe('v1-demo-data');
  });

  it('محاسبه با افزودنی، پکیج شوینده و کد تخفیف', () => {
    const validated = validateQuoteInput({
      serviceId: 'home-standard',
      hours: 4,
      addonIds: ['windows'],
      hasDetergentPackage: true,
      promoCode: 'PAK1403',
    });
    const priced = calculateServerPrice(validated);
    const subtotal = 160000 * 4 + 130000 + 140000;
    expect(priced.subtotal).toBe(subtotal);
    expect(priced.discountsTotal).toBe(100000);
    expect(priced.total).toBe(subtotal - 100000);
  });

  it('تخفیف هرگز مجموع را منفی نمی‌کند', () => {
    const validated = validateQuoteInput({
      serviceId: 'home-standard',
      hours: 4,
      promoCode: 'NEWCUSTOMER',
    });
    const priced = calculateServerPrice(validated);
    expect(priced.total).toBeGreaterThanOrEqual(0);
    expect(priced.discountsTotal).toBeLessThanOrEqual(priced.subtotal);
  });
});
