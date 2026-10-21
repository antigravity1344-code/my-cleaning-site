// @vitest-environment jsdom
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { calculatePrice } from '../../pricing/pricingEngine';
import { orderService } from '../orderService';
import { DEMO_STORAGE_KEY } from '../pii';
import type { BookingOrder } from '../../types';
import { resolveOrderBackendMode } from '../../config/orderBackend';
import { createDemoOrderBackend } from './demoGateway';
import { createIdempotencyKey, IDEMPOTENCY_KEY_PATTERN } from './idempotency';
import {
  createOrderBackend,
  OrderGatewayError,
  type CustomerOrderGateway,
  type OrderRequest,
  type PublicTrackingView,
} from './index';

/**
 * قرارداد عمومی مشتری و adapterهای فعلی.
 *
 * توجه: در این مرحله فقط adapter نمایشی پیاده‌سازی شده است. adapterهای `standalone` و
 * `coordinated` فقط رد می‌کنند. هیچ آزمونی در این فایل اتصال واقعی به بک‌اند سایت یا اپ
 * موبایل را نمی‌سنجد.
 */

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const REQUEST: OrderRequest = {
  serviceId: 'home-deep',
  hours: 6,
  addonIds: ['walls', 'appliances'],
  hasDetergentPackage: true,
  promoCode: 'PAK1403',
  cleanerGender: 'female',
  requestedCleanerId: 'cl-1',
  squareMeters: 120,
  roomsCount: 3,
  date: 'فردا',
  timeSlot: '۰۸:۳۰ الی ۱۲:۳۰ (صبح زود)',
  cityName: 'تهران',
  district: 'ونک',
  address: 'خیابان نمونه، پلاک ۱',
  unit: '۴',
  customerName: 'کاربر آزمایشی',
  customerPhone: '09123456789',
  notes: 'زنگ دوم',
};

const PUBLIC_OPERATIONS = ['getQuote', 'submitOrderRequest', 'trackOrder'];
const ADMIN_LIKE_OPERATIONS = [
  'getOrders',
  'listOrders',
  'getOrderById',
  'updateOrderStatus',
  'setStatus',
  'assignCleaner',
  'cancelOrder',
  'deleteOrder',
  'submitOrderRating',
];

const storedOrders = (): BookingOrder[] => JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) ?? '[]');

describe('قرارداد عمومی مشتری — بدون عملیات مدیریتی', () => {
  it('نوع قرارداد فقط سه عمل دارد و درخواست ثبت هیچ مبلغ، وضعیت، پرداخت یا متخصص تخصیص‌یافته‌ای ندارد', () => {
    expectTypeOf<keyof CustomerOrderGateway>().toEqualTypeOf<'getQuote' | 'submitOrderRequest' | 'trackOrder'>();
    expectTypeOf<OrderRequest>().not.toHaveProperty('totalPrice');
    expectTypeOf<OrderRequest>().not.toHaveProperty('discountApplied');
    expectTypeOf<OrderRequest>().not.toHaveProperty('status');
    expectTypeOf<OrderRequest>().not.toHaveProperty('paymentStatus');
    expectTypeOf<OrderRequest>().not.toHaveProperty('paymentMethod');
    expectTypeOf<OrderRequest>().not.toHaveProperty('cleanerId');
    expectTypeOf<OrderRequest>().not.toHaveProperty('cleanerName');
    expectTypeOf<OrderRequest>().not.toHaveProperty('cleanerPhone');
    expectTypeOf<PublicTrackingView>().not.toHaveProperty('customerName');
    expectTypeOf<PublicTrackingView>().not.toHaveProperty('customerPhone');
    expectTypeOf<PublicTrackingView>().not.toHaveProperty('address');
    expectTypeOf<PublicTrackingView>().not.toHaveProperty('notes');
  });

  it.each([['demo'], ['standalone'], ['coordinated'], [null]] as const)(
    'adapter حالت %s در زمان اجرا هم فقط همان سه عمل را دارد',
    (mode) => {
      const { gateway } = createOrderBackend(mode);
      expect(Object.keys(gateway).sort()).toEqual([...PUBLIC_OPERATIONS].sort());
      for (const name of ADMIN_LIKE_OPERATIONS) expect(gateway).not.toHaveProperty(name);
    },
  );

  it('امکانات فقط‌نمایشی (فهرست، امتیاز و لغو محلی) فقط در حالت نمایشی و جدا از قرارداد عمومی است', () => {
    expect(createOrderBackend('demo').demoLedger).not.toBeNull();
    expect(createOrderBackend('standalone').demoLedger).toBeNull();
    expect(createOrderBackend('coordinated').demoLedger).toBeNull();
    expect(createOrderBackend(null).demoLedger).toBeNull();
  });
});

describe('adapter نمایشی — مبلغ، وضعیت و پرداخت را خودش تعیین می‌کند', () => {
  it('پیش‌فاکتور همان مبلغ موتور نمایشی فعلی است و غیرقطعی علامت می‌خورد', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const quote = await gateway.getQuote(REQUEST);
    const engine = calculatePrice({
      serviceId: 'home-deep',
      hours: 6,
      addonIds: ['walls', 'appliances'],
      hasDetergentPackage: true,
      promoCode: 'PAK1403',
    });
    expect(quote.total).toBe(engine.total);
    expect(quote.discountsTotal).toBe(engine.discountsTotal);
    // ۶ × ۱۹۰٬۰۰۰ + ۱۸۰٬۰۰۰ + ۱۵۰٬۰۰۰ + ۱۴۰٬۰۰۰ − ۱۰۰٬۰۰۰
    expect(quote.total).toBe(1_510_000);
    expect(quote.isProvisional).toBe(true);
  });

  it('مبلغ، وضعیت، پرداخت و متخصصِ ارسالی از مرورگر را نادیده می‌گیرد', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const tampered = {
      ...REQUEST,
      totalPrice: 1,
      discountApplied: 999_999,
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'online',
      cleanerId: 'cl-2',
      cleanerName: 'نام جعلی',
      cleanerPhone: '09120000000',
    } as unknown as OrderRequest;

    const receipt = await gateway.submitOrderRequest(tampered, { idempotencyKey: createIdempotencyKey() });

    expect(receipt.total).toBe(1_510_000);
    expect(receipt.status).toBe('new');
    expect(receipt.isProvisional).toBe(true);
    const [stored] = storedOrders();
    expect(stored.totalPrice).toBe(1_510_000);
    expect(stored.discountApplied).toBe(100_000);
    expect(stored.status).toBe('pending');
    expect(stored.paymentStatus).toBe('unpaid');
    expect(stored.paymentMethod).toBe('cash_on_site');
    expect(stored.cleanerId).toBeUndefined();
    expect(stored.cleanerPhone).toBeUndefined();
    // ترجیح مشتری فقط «درخواست» است، نه تخصیص.
    expect(stored.requestedCleanerId).toBe('cl-1');
  });

  it('روی دیسک فقط نسخهٔ ماسک‌شده می‌ماند و نسخهٔ کامل فقط در حافظهٔ همین نشست است', async () => {
    const { gateway, ledger } = createDemoOrderBackend(orderService);
    const receipt = await gateway.submitOrderRequest(REQUEST, { idempotencyKey: createIdempotencyKey() });
    const raw = localStorage.getItem(DEMO_STORAGE_KEY) ?? '';
    expect(raw).not.toContain('09123456789');
    expect(raw).not.toContain('خیابان نمونه');
    expect(ledger.getSessionRecord(receipt.trackingCode)?.customerPhone).toBe('09123456789');
  });

  it('کلید تکرار یکسان با درخواست یکسان سفارش دوم نمی‌سازد', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const options = { idempotencyKey: createIdempotencyKey() };
    const first = await gateway.submitOrderRequest(REQUEST, options);
    const second = await gateway.submitOrderRequest({ ...REQUEST }, options);
    expect(second).toEqual(first);
    expect(storedOrders()).toHaveLength(1);
  });

  it('کلید تکرار یکسان با درخواست متفاوت رد می‌شود (conflict)', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const options = { idempotencyKey: createIdempotencyKey() };
    await gateway.submitOrderRequest(REQUEST, options);
    await expect(gateway.submitOrderRequest({ ...REQUEST, hours: 7 }, options)).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(storedOrders()).toHaveLength(1);
  });

  it('خطای ذخیرهٔ مرورگر با نوع local_storage برمی‌گردد و هیچ رسیدی ساخته نمی‌شود', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const error = await gateway
      .submitOrderRequest(REQUEST, { idempotencyKey: createIdempotencyKey() })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OrderGatewayError);
    expect((error as OrderGatewayError).kind).toBe('local_storage');
  });

  it('پیگیری با کد فقط خدمت، تاریخ، بازه، شهر و وضعیت را برمی‌گرداند', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const receipt = await gateway.submitOrderRequest(REQUEST, { idempotencyKey: createIdempotencyKey() });
    const view = await gateway.trackOrder(receipt.trackingCode.toLowerCase());
    expect(view).not.toBeNull();
    expect(Object.keys(view!).sort()).toEqual(
      ['cityName', 'createdAt', 'date', 'serviceTitle', 'status', 'timeSlot', 'trackingCode'].sort(),
    );
    expect(JSON.stringify(view)).not.toMatch(/0912|خیابان نمونه|کاربر آزمایشی|زنگ دوم/);
    expect(await gateway.trackOrder('DEMO-NOTEXIST')).toBeNull();
  });
});

describe('adapterهای پیاده‌سازی‌نشده — بدون بازگشت پنهانی به ذخیرهٔ نمایشی', () => {
  it.each([['standalone'], ['coordinated'], [null]] as const)(
    'حالت %s هر عمل را با not_implemented رد می‌کند و به localStorage دست نمی‌زند',
    async (mode) => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const { gateway } = createOrderBackend(mode);

      for (const call of [
        () => gateway.getQuote(REQUEST),
        () => gateway.submitOrderRequest(REQUEST, { idempotencyKey: createIdempotencyKey() }),
        () => gateway.trackOrder('DEMO-ABCDEF'),
      ]) {
        await expect(call()).rejects.toMatchObject({ kind: 'not_implemented' });
      }
      expect(getItem).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
      expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
    },
  );
});

describe('انتخاب حالت فقط از تنظیمات راه‌اندازی', () => {
  it.each([
    [undefined, 'demo'],
    ['', 'demo'],
    ['  ', 'demo'],
    ['demo', 'demo'],
    [' standalone ', 'standalone'],
    ['coordinated', 'coordinated'],
    ['Demo', null],
    ['production', null],
    ['local', null],
  ] as const)('مقدار %j ← %j', (raw, expected) => {
    expect(resolveOrderBackendMode(raw)).toBe(expected);
  });

  it('حالت از VITE_ORDER_BACKEND خوانده می‌شود، نه از نشانی صفحه یا حافظهٔ مرورگر', async () => {
    try {
      localStorage.setItem('VITE_ORDER_BACKEND', 'standalone');
      localStorage.setItem('orderBackend', 'standalone');
      window.history.replaceState(null, '', '/?orderBackend=standalone&VITE_ORDER_BACKEND=standalone');
      vi.stubEnv('VITE_ORDER_BACKEND', '');
      vi.resetModules();
      const unset = await import('../../config/orderBackend');
      expect(unset.ORDER_BACKEND_MODE).toBe('demo');

      vi.stubEnv('VITE_ORDER_BACKEND', 'coordinated');
      vi.resetModules();
      const configured = await import('../../config/orderBackend');
      expect(configured.ORDER_BACKEND_MODE).toBe('coordinated');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
      window.history.replaceState(null, '', '/');
    }
  });
});

describe('کلید تکرار', () => {
  it('با الگوی هر دو بک‌اند سازگار و در هر تلاش یکتاست', () => {
    const keys = new Set(Array.from({ length: 200 }, () => createIdempotencyKey()));
    expect(keys.size).toBe(200);
    for (const key of keys) expect(key).toMatch(IDEMPOTENCY_KEY_PATTERN);
  });

  it('بدون randomUUID هم از مولد امن کلید می‌سازد و بدون مولد امن کلید نمی‌سازد', () => {
    const key = createIdempotencyKey({ getRandomValues: (array) => globalThis.crypto.getRandomValues(array) });
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(() => createIdempotencyKey(null)).toThrow(/مولد/);
  });
});
