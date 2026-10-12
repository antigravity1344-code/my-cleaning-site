import { describe, expect, it } from 'vitest';
import {
  DEMO_STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
  REDACTED_PLACEHOLDER,
  containsRawCustomerPii,
  maskName,
  maskPhone,
  purgeLegacyStorage,
  redactOrderForStorage,
  toLatinDigits,
} from './pii';
import type { BookingOrder } from '../types';

const buildOrder = (overrides: Partial<BookingOrder> = {}): BookingOrder => ({
  id: 'demo-1',
  trackingCode: 'DEMO-ABCDEF123456',
  createdAt: new Date().toISOString(),
  status: 'pending',
  recordType: 'demo',
  paymentStatus: 'unpaid',
  serviceId: 'home-standard',
  serviceTitle: 'نظافت استاندارد منزل',
  cleanerGender: 'no-pref',
  hours: 4,
  selectedAddons: [],
  hasDetergentPackage: true,
  date: 'امروز',
  timeSlot: '۰۹:۰۰ الی ۱۳:۰۰ (صبح)',
  cityName: 'تهران',
  district: 'سعادت‌آباد و شهرک غرب',
  address: 'خیابان نمونه، کوچه ۳، پلاک ۱۲',
  unit: 'طبقه ۳، واحد ۸',
  customerName: 'سارا محمدی',
  customerPhone: '09123456789',
  notes: 'دو گربه داریم و کلید زیر گلدان است',
  totalPrice: 780_000,
  discountApplied: 0,
  paymentMethod: 'cash_on_site',
  ...overrides,
});

describe('toLatinDigits', () => {
  it('ارقام فارسی را به لاتین تبدیل می‌کند', () => {
    expect(toLatinDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
  });

  it('ارقام عربی را هم پشتیبانی می‌کند', () => {
    expect(toLatinDigits('٠٩١٢')).toBe('0912');
  });
});

describe('maskPhone — ماسک‌کردن شماره تماس مشتری', () => {
  it('فقط ابتدا و انتهای شماره را نگه می‌دارد', () => {
    expect(maskPhone('09123456789')).toBe('0912***789');
  });

  it('شماره فارسی را هم ماسک می‌کند', () => {
    expect(maskPhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('0912***789');
  });

  it('شماره کوتاه یا نامعتبر را کامل پنهان می‌کند', () => {
    expect(maskPhone('123')).toBe('***');
    expect(maskPhone('')).toBe('***');
  });
});

describe('maskName — ماسک‌کردن نام مشتری', () => {
  it('فقط حرف اول هر بخش را نگه می‌دارد', () => {
    expect(maskName('سارا محمدی')).toBe('س. م.');
  });

  it('نام تک‌بخشی را هم ماسک می‌کند', () => {
    expect(maskName('سارا')).toBe('س.');
  });

  it('ورودی خالی را مدیریت می‌کند', () => {
    expect(maskName('   ')).toBe('');
  });
});

describe('redactOrderForStorage — حذف اطلاعات شخصی پیش از ذخیره‌سازی', () => {
  it('نشانی دقیق را حذف می‌کند', () => {
    const redacted = redactOrderForStorage(buildOrder());
    expect(redacted.address).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.address).not.toContain('پلاک ۱۲');
  });

  it('واحد و توضیحات آزاد را پاک می‌کند (ممکن است حاوی اطلاعات حساس باشد)', () => {
    const redacted = redactOrderForStorage(buildOrder());
    expect(redacted.unit).toBe('');
    expect(redacted.notes).toBeUndefined();
  });

  it('نام و شماره تماس را ماسک می‌کند', () => {
    const redacted = redactOrderForStorage(buildOrder());
    expect(redacted.customerName).toBe('س. م.');
    expect(redacted.customerPhone).toBe('0912***789');
  });

  it('هیچ شماره تماس متخصصی را نگه نمی‌دارد', () => {
    const redacted = redactOrderForStorage(buildOrder({ cleanerPhone: '09121234567' }));
    expect(redacted.cleanerPhone).toBeUndefined();
  });

  it('خروجی دیگر حاوی اطلاعات شخصی خام شناسایی‌شده نیست', () => {
    const redacted = redactOrderForStorage(buildOrder());
    expect(containsRawCustomerPii(redacted)).toBe(false);
  });

  it('اطلاعات غیرشخصی سفارش برای نمایش حفظ می‌شود', () => {
    const redacted = redactOrderForStorage(buildOrder());
    expect(redacted.trackingCode).toBe('DEMO-ABCDEF123456');
    expect(redacted.totalPrice).toBe(780_000);
    expect(redacted.serviceTitle).toBe('نظافت استاندارد منزل');
    expect(redacted.status).toBe('pending');
  });
});

describe('containsRawCustomerPii — تشخیص اطلاعات ذخیره‌نشده‌ی خام', () => {
  it('سفارش ذخیره‌نشده خام را تشخیص می‌دهد', () => {
    expect(containsRawCustomerPii(buildOrder())).toBe(true);
  });

  it('سفارش ماسک‌شده را پاک اعلام می‌کند', () => {
    expect(containsRawCustomerPii(redactOrderForStorage(buildOrder()))).toBe(false);
  });
});

describe('purgeLegacyStorage — پاک‌سازی کلید نسخه قبلی', () => {
  it('کلید قدیمی که اطلاعات خام مشتری داشت را حذف می‌کند', () => {
    const removed: string[] = [];
    purgeLegacyStorage({ removeItem: (key: string) => { removed.push(key); } });

    LEGACY_STORAGE_KEYS.forEach((key) => {
      expect(removed).toContain(key);
    });
  });

  it('در صورت خطای دسترسی به حافظه، استثنا پرتاب نمی‌کند', () => {
    expect(() =>
      purgeLegacyStorage({
        removeItem: () => {
          throw new Error('storage blocked');
        },
      }),
    ).not.toThrow();
  });

  it('کلید ذخیره‌سازی جدید با کلید قدیمی یکسان نیست', () => {
    expect(LEGACY_STORAGE_KEYS).not.toContain(DEMO_STORAGE_KEY);
    expect(DEMO_STORAGE_KEY).toMatch(/_v\d+$/);
  });
});
