// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orderService } from './orderService';
import { DEMO_STORAGE_KEY } from './pii';
import type { CreateOrderDTO } from './orderService.types';

/**
 * SAFETY-008 — یکپارچگی حافظه سفارش‌های آزمایشی.
 *
 * پیش از این، اگر مقدار ذخیره‌شده خراب/ناخوانا بود، خواندن آن «فهرست خالی» برمی‌گرداند و
 * ثبت سفارش/امتیاز/لغو بعدی کل کلید را با فهرست جدید بازنویسی می‌کرد؛ یعنی رکوردهای
 * قبلی بی‌صدا پاک می‌شدند. این آزمون‌ها روی **مقدار واقعی localStorage** کار می‌کنند.
 */

const buildPayload = (overrides: Partial<CreateOrderDTO> = {}): CreateOrderDTO => ({
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
  address: 'خیابان نمونه',
  unit: '',
  customerName: 'کاربر آزمایشی',
  customerPhone: '09123456789',
  totalPrice: 780_000,
  discountApplied: 0,
  paymentMethod: 'cash_on_site',
  ...overrides,
});

const VALID_RECORD = {
  id: 'demo-existing',
  trackingCode: 'DEMO-EXISTING',
  createdAt: '2026-10-15T10:00:00.000Z',
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
  timeSlot: 'صبح',
  cityName: 'تهران',
  district: 'مرکز',
  address: '(در نسخه آزمایشی ذخیره نمی‌شود)',
  unit: '',
  customerName: 'ک. آ.',
  customerPhone: '0912***789',
  totalPrice: 780_000,
  discountApplied: 0,
  paymentMethod: 'cash_on_site',
};

/** حالت‌هایی که «داده هست اما سالم/کامل خوانده نمی‌شود». */
const CORRUPTED_VALUES: Array<[string, string]> = [
  ['JSON نامعتبر', '{not valid json'],
  ['JSON غیرآرایه', JSON.stringify({ orders: [VALID_RECORD] })],
  ['آرایه با یک رکورد نامعتبر', JSON.stringify([VALID_RECORD, { foo: 'bar' }])],
];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SAFETY-008 — داده خراب هرگز بی‌صدا بازنویسی نمی‌شود', () => {
  it.each(CORRUPTED_VALUES)('ثبت سفارش روی %s رد می‌شود و مقدار ذخیره‌شده بایت‌به‌بایت دست‌نخورده می‌ماند', async (_label, raw) => {
    localStorage.setItem(DEMO_STORAGE_KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await expect(orderService.createOrder(buildPayload())).rejects.toThrow(/ذخیره‌سازی محلی/);

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(raw);
  });

  it.each(CORRUPTED_VALUES)('ثبت امتیاز و لغو روی %s هم رد می‌شوند و چیزی نوشته نمی‌شود', async (_label, raw) => {
    localStorage.setItem(DEMO_STORAGE_KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await expect(orderService.submitOrderRating(VALID_RECORD.id, 5)).rejects.toThrow(/ذخیره‌سازی محلی/);
    await expect(orderService.cancelOrder(VALID_RECORD.id)).rejects.toThrow(/ذخیره‌سازی محلی/);

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(raw);
  });

  it('اگر خواندن حافظه خطا بدهد، ثبت سفارش رد می‌شود و هیچ نوشتنی انجام نمی‌شود', async () => {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify([VALID_RECORD]));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await expect(orderService.createOrder(buildPayload())).rejects.toThrow(/ذخیره‌سازی محلی/);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('نمایش فهرست روی داده‌ای با یک رکورد نامعتبر، رکوردهای سالم را نشان می‌دهد و چیزی نمی‌نویسد', async () => {
    const raw = JSON.stringify([VALID_RECORD, { foo: 'bar' }]);
    localStorage.setItem(DEMO_STORAGE_KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    const orders = await orderService.getOrders();

    expect(orders.map((order) => order.id)).toEqual([VALID_RECORD.id]);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(raw);
  });

  it('نمایش فهرست روی JSON نامعتبر، فهرست خالی برمی‌گرداند بدون پاک‌کردن داده', async () => {
    localStorage.setItem(DEMO_STORAGE_KEY, '{not valid json');
    await expect(orderService.getOrders()).resolves.toEqual([]);
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe('{not valid json');
  });
});

describe('SAFETY-008 — مسیر سالم بدون تغییر رفتار', () => {
  it('روی حافظه خالی، سفارش ثبت می‌شود', async () => {
    const created = await orderService.createOrder(buildPayload());
    const stored = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) ?? '[]');
    expect(stored.map((order: { id: string }) => order.id)).toEqual([created.id]);
  });

  it('روی حافظه سالم، سفارش جدید اضافه می‌شود و رکورد قبلی حفظ می‌شود', async () => {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify([VALID_RECORD]));
    const created = await orderService.createOrder(buildPayload());
    const stored = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) ?? '[]');
    expect(stored.map((order: { id: string }) => order.id)).toEqual([created.id, VALID_RECORD.id]);
  });

  it('روی حافظه سالم، امتیاز و لغو همچنان کار می‌کنند', async () => {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify([VALID_RECORD]));
    await expect(orderService.submitOrderRating(VALID_RECORD.id, 4)).resolves.toMatchObject({ userRating: 4 });
    await expect(orderService.cancelOrder(VALID_RECORD.id)).resolves.toMatchObject({ status: 'cancelled' });
  });
});
