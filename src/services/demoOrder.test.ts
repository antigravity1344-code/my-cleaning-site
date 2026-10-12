import { describe, expect, it } from 'vitest';
import { buildDemoOrderPayload, DEMO_ORDER_STATUS, DEMO_TRACKING_PREFIX, generateDemoTrackingCode } from './demoOrder';
import type { DemoOrderFormInput } from './demoOrder';

/**
 * آزمون‌های ساخت سفارش آزمایشی.
 *
 * این آزمون‌ها تضمین می‌کنند رفتارهای گمراه‌کننده نسخه قبلی دیگر تکرار نشوند:
 * شماره تماس ساختگی، تخصیص متخصص جعلی، وضعیت عملیاتی جعلی و پرداخت آنلاین ناموجود.
 */

const baseInput: DemoOrderFormInput = {
  serviceId: 'home-standard',
  serviceTitle: 'نظافت استاندارد منزل',
  cleanerGender: 'no-pref',
  hours: 4,
  squareMeters: 90,
  roomsCount: 2,
  selectedAddons: [],
  hasDetergentPackage: true,
  date: 'امروز',
  timeSlot: '۰۹:۰۰ الی ۱۳:۰۰ (صبح)',
  cityName: 'تهران',
  district: 'سعادت‌آباد و شهرک غرب',
  address: 'خیابان نمونه، پلاک ۱',
  unit: 'واحد ۲',
  customerName: 'کاربر آزمایشی',
  customerPhone: '09123456789',
  notes: 'یادداشت آزمایشی',
  totalPrice: 780_000,
  discountApplied: 0,
};

describe('buildDemoOrderPayload — جلوگیری از تولید شماره تماس ساختگی', () => {
  it('هیچ شماره تماس متخصصی تولید یا ثبت نمی‌کند', () => {
    const payload = buildDemoOrderPayload(baseInput);

    expect(payload.cleanerPhone).toBeUndefined();
    expect(payload.cleanerId).toBeUndefined();
    expect(payload.cleanerName).toBeUndefined();
  });

  it('هیچ شماره تلفنی شبیه الگوی جعلی قبلی (۰۹۱۲ + ارقام) در payload وجود ندارد', () => {
    const payload = buildDemoOrderPayload(baseInput);
    const serialized = JSON.stringify(payload);

    // الگوی پیشین: '۰۹۱۲' + ۷ رقم تصادفی
    expect(serialized).not.toMatch(/۰۹۱۲[\d۰-۹]{7}/);
    // هیچ شماره موبایل دیگری هم نباید در فیلدهای متخصص ظاهر شود
    expect(payload.cleanerPhone).toBeUndefined();
  });

  it('انتخاب کاربر از فهرست نمونه را فقط به‌عنوان «درخواست» ثبت می‌کند نه تخصیص', () => {
    const payload = buildDemoOrderPayload({
      ...baseInput,
      requestedCleanerId: 'cl-1',
      requestedCleanerName: 'مریم رضایی',
    });

    expect(payload.requestedCleanerId).toBe('cl-1');
    expect(payload.requestedCleanerName).toBe('مریم رضایی');
    // فیلدهای تخصیص واقعی باید خالی بمانند
    expect(payload.cleanerId).toBeUndefined();
    expect(payload.cleanerName).toBeUndefined();
  });
});

describe('buildDemoOrderPayload — عدم ادعای وضعیت و پرداخت واقعی', () => {
  it('وضعیت سفارش را «در انتظار بررسی» می‌گذارد، نه «متخصص تخصیص یافت»', () => {
    const payload = buildDemoOrderPayload(baseInput);

    expect(payload.status).toBe(DEMO_ORDER_STATUS);
    expect(payload.status).toBe('pending');
    expect(payload.status).not.toBe('assigned');
    expect(payload.status).not.toBe('on_the_way');
    expect(payload.status).not.toBe('in_progress');
    expect(payload.status).not.toBe('completed');
  });

  it('وضعیت پرداخت را «پرداخت‌نشده» ثبت می‌کند', () => {
    const payload = buildDemoOrderPayload(baseInput);
    expect(payload.paymentStatus).toBe('unpaid');
  });

  it('پرداخت آنلاین ناموجود را انتخاب نمی‌کند (حتی اگر ورودی آن را بخواهد)', () => {
    const payload = buildDemoOrderPayload({
      ...baseInput,
      paymentMethodOnlineRequested: true,
    } as DemoOrderFormInput & { paymentMethodOnlineRequested?: boolean });

    expect(payload.paymentMethod).not.toBe('online');
    expect(payload.paymentMethod).toBe('cash_on_site');
  });

  it('مقادیر مالی محاسبه‌شده را همان‌طور منتقل می‌کند (بدون دست‌کاری)', () => {
    const payload = buildDemoOrderPayload({ ...baseInput, totalPrice: 1_234_000, discountApplied: 50_000 });
    expect(payload.totalPrice).toBe(1_234_000);
    expect(payload.discountApplied).toBe(50_000);
  });

  it('تابع خالص است و به شبکه یا مرورگر وابسته نیست', () => {
    const a = buildDemoOrderPayload(baseInput);
    const b = buildDemoOrderPayload(baseInput);
    expect(b).toEqual(a);
  });
});

describe('generateDemoTrackingCode', () => {
  it('کد را با پیشوند آزمایشی می‌سازد تا با کد عملیاتی سرور اشتباه نشود', () => {
    const code = generateDemoTrackingCode();
    expect(code.startsWith(DEMO_TRACKING_PREFIX)).toBe(true);
  });

  it('آنتروپی کافی دارد و در حجم بالا تصادم نمی‌سازد', () => {
    const codes = new Set<string>();
    const all: string[] = [];
    for (let index = 0; index < 2_000; index += 1) {
      const code = generateDemoTrackingCode(all);
      all.push(code);
      codes.add(code);
    }
    expect(codes.size).toBe(2_000);
    expect(all.every((code) => code.length > DEMO_TRACKING_PREFIX.length + 6)).toBe(true);
  });

  it('کد تکراری نسبت به کدهای موجود تولید نمی‌کند', () => {
    const existing = [generateDemoTrackingCode()];
    const next = generateDemoTrackingCode(existing);
    expect(existing).not.toContain(next);
  });

  it('الگوی ضعیف قبلی (PAK-##### پنج رقمی) را تولید نمی‌کند', () => {
    for (let index = 0; index < 200; index += 1) {
      const code = generateDemoTrackingCode();
      expect(code).not.toMatch(/^PAK-\d{5}$/);
    }
  });
});
