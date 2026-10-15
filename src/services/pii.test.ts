import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_STORAGE_KEY,
  LEGACY_DATA_NOTICE,
  LEGACY_STORAGE_KEYS,
  REDACTED_PLACEHOLDER,
  containsPiiInFreeText,
  containsRawCustomerPii,
  hasLegacyStoredData,
  maskName,
  maskPhone,
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

  it('متن آزاد بازخورد قدیمی را حذف می‌کند (فهرست سفید صریح)', () => {
    const legacyRecord = {
      ...buildOrder(),
      userFeedback: 'با من تماس بگیرید ۰۹۱۲۳۴۵۶۷۸۹، خیابان ولیعصر پلاک ۱۰',
    } as unknown as BookingOrder;

    const redacted = redactOrderForStorage(legacyRecord);
    const serialized = JSON.stringify(redacted);

    expect('userFeedback' in redacted).toBe(false);
    expect(serialized).not.toContain('userFeedback');
    expect(serialized).not.toContain('۰۹۱۲۳۴۵۶۷۸۹');
    expect(serialized).not.toContain('خیابان ولیعصر');
  });

  it('فقط فیلدهای فهرست سفید را برمی‌گرداند و فیلد ناشناخته را عبور نمی‌دهد', () => {
    const withUnknownField = {
      ...buildOrder(),
      secretInternalNote: 'این فیلد نباید ذخیره شود',
    } as unknown as BookingOrder;

    const redacted = redactOrderForStorage(withUnknownField) as unknown as Record<string, unknown>;
    expect(redacted.secretInternalNote).toBeUndefined();
    expect(JSON.stringify(redacted)).not.toContain('secretInternalNote');
  });
});

describe('containsRawCustomerPii — تشخیص اطلاعات ذخیره‌نشده‌ی خام', () => {
  it('سفارش ذخیره‌نشده خام را تشخیص می‌دهد', () => {
    expect(containsRawCustomerPii(buildOrder())).toBe(true);
  });

  it('سفارش ماسک‌شده را پاک اعلام می‌کند', () => {
    expect(containsRawCustomerPii(redactOrderForStorage(buildOrder()))).toBe(false);
  });

  it('متن آزاد بازخورد حاوی شماره تماس را به‌عنوان PII تشخیص می‌دهد', () => {
    const withFeedback = {
      ...redactOrderForStorage(buildOrder()),
      userFeedback: 'لطفا قبل از آمدن زنگ بزنید ۰۹۱۲۳۴۵۶۷۸۹',
    } as unknown as BookingOrder;

    expect(containsRawCustomerPii(withFeedback)).toBe(true);
  });
});

describe('containsPiiInFreeText — پایش متن آزاد', () => {
  it('شماره موبایل لاتین و فارسی را تشخیص می‌دهد', () => {
    expect(containsPiiInFreeText('تماس: 09123456789')).toBe(true);
    expect(containsPiiInFreeText('تماس: ۰۹۱۲۳۴۵۶۷۸۹')).toBe(true);
  });

  it('متن عادی را پاک اعلام می‌کند', () => {
    expect(containsPiiInFreeText('نظافت آشپزخانه خوب بود')).toBe(false);
    expect(containsPiiInFreeText('')).toBe(false);
    expect(containsPiiInFreeText(undefined)).toBe(false);
  });
});

describe('hasLegacyStoredData — تشخیص بدون مداخله', () => {
  it('وجود داده قدیمی را تشخیص می‌دهد اما آن را حذف نمی‌کند', () => {
    const store = new Map<string, string>([['paksho_orders', '[{"id":"legacy-1"}]']]);
    const removed: string[] = [];

    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => {
        removed.push(key);
        store.delete(key);
      },
    };

    expect(hasLegacyStoredData(storage)).toBe(true);
    // هیچ کلیدی نباید حذف شده باشد
    expect(removed).toHaveLength(0);
    expect(store.get('paksho_orders')).toBe('[{"id":"legacy-1"}]');
  });

  it('وقتی داده قدیمی وجود ندارد، false برمی‌گرداند', () => {
    expect(hasLegacyStoredData({ getItem: () => null })).toBe(false);
    expect(hasLegacyStoredData({ getItem: () => '' })).toBe(false);
  });

  it('در صورت خطای دسترسی به حافظه، استثنا پرتاب نمی‌کند', () => {
    const blocked = {
      getItem: () => {
        throw new Error('storage blocked');
      },
    };
    expect(() => hasLegacyStoredData(blocked)).not.toThrow();
    expect(hasLegacyStoredData(blocked)).toBe(false);
  });

  it('کلید ذخیره‌سازی جدید با کلید قدیمی یکسان نیست', () => {
    expect(LEGACY_STORAGE_KEYS).not.toContain(DEMO_STORAGE_KEY);
    expect(DEMO_STORAGE_KEY).toMatch(/_v\d+$/);
  });

  it('پیام اطلاع‌رسانی صریح است و وعده حذف خودکار نمی‌دهد', () => {
    expect(LEGACY_DATA_NOTICE).toContain('حذف نمی‌شود');
    expect(LEGACY_DATA_NOTICE).not.toContain('به‌طور خودکار');
    expect(LEGACY_DATA_NOTICE.length).toBeGreaterThan(40);
  });

  it('SAFETY-008: پیام کاربر انکار نمی‌کند که مقدار برای بررسی وجود خوانده می‌شود', () => {
    // hasLegacyStoredData واقعاً مقدار کلید قدیمی را با getItem می‌خواند (فقط برای بررسی خالی‌نبودن)؛
    // پس پیام کاربر نباید بگوید داده «خوانده نمی‌شود».
    const getItem = vi.fn(() => 'legacy-raw-value');
    expect(hasLegacyStoredData({ getItem })).toBe(true);
    expect(getItem).toHaveBeenCalledWith(LEGACY_STORAGE_KEYS[0]);

    expect(LEGACY_DATA_NOTICE).not.toMatch(/خوانده[^.؛]*نمی‌شود/);
    expect(LEGACY_DATA_NOTICE).toContain('فقط وجود آن را بررسی');
    expect(LEGACY_DATA_NOTICE).toMatch(/محتوای آن پردازش، نمایش داده، منتقل یا حذف نمی‌شود/);
  });
});
