// @vitest-environment jsdom
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { calculatePrice } from '../../pricing/pricingEngine';
import { orderService } from '../orderService';
import { DEMO_STORAGE_KEY } from '../pii';
import type { BookingOrder } from '../../types';
import { resolveOrderBackendMode } from '../../config/orderBackend';
import { createDemoOrderBackend, DEMO_QUOTE_TTL_MS } from './demoGateway';
import { createIdempotencyKey, IDEMPOTENCY_KEY_PATTERN } from './idempotency';
import { createSubmissionCoordinator } from './submissionCoordinator';
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

const BASE: Omit<OrderRequest, 'acceptedQuote'> = {
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

/** درخواستی با پیش‌فاکتور ساختگی؛ فقط برای adapterهایی که آن را نمی‌سنجند. */
const REQUEST: OrderRequest = { ...BASE, acceptedQuote: { reference: 'TEST-QUOTE', total: 1 } };

/** درخواستی که پیش‌فاکتور واقعیِ همان adapter را پذیرفته است. */
const quoted = async (
  gateway: CustomerOrderGateway,
  base: Omit<OrderRequest, 'acceptedQuote'> = BASE,
): Promise<OrderRequest> => {
  const quote = await gateway.getQuote(base);
  return { ...base, acceptedQuote: { reference: quote.reference, total: quote.total } };
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
    const quote = await gateway.getQuote(BASE);
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
      ...(await quoted(gateway)),
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
    const receipt = await gateway.submitOrderRequest(await quoted(gateway), { idempotencyKey: createIdempotencyKey() });
    const raw = localStorage.getItem(DEMO_STORAGE_KEY) ?? '';
    expect(raw).not.toContain('09123456789');
    expect(raw).not.toContain('خیابان نمونه');
    expect(ledger.getSessionRecord(receipt.trackingCode)?.customerPhone).toBe('09123456789');
  });

  it('کلید تکرار یکسان با درخواست یکسان سفارش دوم نمی‌سازد', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    const options = { idempotencyKey: createIdempotencyKey() };
    const first = await gateway.submitOrderRequest(request, options);
    const second = await gateway.submitOrderRequest({ ...request }, options);
    expect(second).toEqual(first);
    expect(storedOrders()).toHaveLength(1);
  });

  it('کلید تکرار یکسان با درخواست متفاوت رد می‌شود (conflict)', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    const options = { idempotencyKey: createIdempotencyKey() };
    await gateway.submitOrderRequest(request, options);
    await expect(gateway.submitOrderRequest({ ...request, hours: 7 }, options)).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(storedOrders()).toHaveLength(1);
  });

  it('دو درخواست هم‌زمان با کلید و محتوای یکسان فقط یک سفارش می‌سازند و هر دو همان رسید را می‌گیرند', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    const options = { idempotencyKey: createIdempotencyKey() };
    const [first, second] = await Promise.all([
      gateway.submitOrderRequest(request, options),
      gateway.submitOrderRequest({ ...request }, options),
    ]);
    expect(second).toEqual(first);
    expect(storedOrders()).toHaveLength(1);
  });

  it('دو درخواست هم‌زمان با کلید یکسان و محتوای متفاوت: فقط اولی ثبت می‌شود و دومی conflict می‌گیرد', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    const options = { idempotencyKey: createIdempotencyKey() };
    const results = await Promise.allSettled([
      gateway.submitOrderRequest(request, options),
      gateway.submitOrderRequest({ ...request, hours: 7 }, options),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect((results[1] as PromiseRejectedResult).reason).toMatchObject({ kind: 'conflict' });
    expect(storedOrders()).toHaveLength(1);
    expect(storedOrders()[0].hours).toBe(6);
  });

  it('پس از شکست قطعی ذخیره، تلاش دوباره با همان کلید و همان درخواست ممکن است و فقط یک سفارش می‌سازد', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    const options = { idempotencyKey: createIdempotencyKey() };
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    await expect(gateway.submitOrderRequest(request, options)).rejects.toMatchObject({ kind: 'local_storage' });
    expect(storedOrders()).toHaveLength(0);
    setItem.mockRestore();

    const receipt = await gateway.submitOrderRequest(request, options);
    expect(receipt.trackingCode).toMatch(/^DEMO-/);
    expect(storedOrders()).toHaveLength(1);
  });

  it('درخواست هم‌زمانِ یکسان با تلاشی که شکست قطعی می‌خورد، همان شکست را می‌گیرد و سفارشی نمی‌سازد', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    const options = { idempotencyKey: createIdempotencyKey() };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const results = await Promise.allSettled([
      gateway.submitOrderRequest(request, options),
      gateway.submitOrderRequest({ ...request }, options),
    ]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toMatchObject({ kind: 'local_storage' });
    }
    expect(storedOrders()).toHaveLength(0);
  });

  it('خطای ذخیرهٔ مرورگر با نوع local_storage برمی‌گردد و هیچ رسیدی ساخته نمی‌شود', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const error = await gateway
      .submitOrderRequest(request, { idempotencyKey: createIdempotencyKey() })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OrderGatewayError);
    expect((error as OrderGatewayError).kind).toBe('local_storage');
  });

  it('پیگیری با کد فقط خدمت، تاریخ، بازه، شهر و وضعیت را برمی‌گرداند', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const receipt = await gateway.submitOrderRequest(await quoted(gateway), { idempotencyKey: createIdempotencyKey() });
    const view = await gateway.trackOrder(receipt.trackingCode.toLowerCase());
    expect(view).not.toBeNull();
    expect(Object.keys(view!).sort()).toEqual(
      ['cityName', 'createdAt', 'date', 'serviceTitle', 'status', 'timeSlot', 'trackingCode'].sort(),
    );
    expect(JSON.stringify(view)).not.toMatch(/0912|خیابان نمونه|کاربر آزمایشی|زنگ دوم/);
    expect(await gateway.trackOrder('DEMO-NOTEXIST')).toBeNull();
  });
});

describe('adapter نمایشی — ثبت فقط با پیش‌فاکتور تأییدشده', () => {
  const clock = (start = 1_800_000_000_000) => {
    let current = start;
    return { now: () => current, advance: (ms: number) => (current += ms) };
  };

  it('پیش‌فاکتور مرجع یکتا و مهلت ۱۵ دقیقه‌ای دارد', async () => {
    const time = clock();
    const { gateway } = createDemoOrderBackend(orderService, { now: time.now });
    const first = await gateway.getQuote(BASE);
    const second = await gateway.getQuote(BASE);
    expect(first.reference).toMatch(/^DEMO-Q-[0-9a-f]{24}$/);
    expect(second.reference).not.toBe(first.reference);
    expect(Date.parse(first.expiresAt as string)).toBe(time.now() + DEMO_QUOTE_TTL_MS);
  });

  it('کد تخفیف ناشناخته در پیش‌فاکتور با خطای اعتبارسنجیِ فیلد promoCode رد می‌شود', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    await expect(gateway.getQuote({ ...BASE, promoCode: 'NOPE' })).rejects.toMatchObject({
      kind: 'validation',
      field: 'promoCode',
    });
  });

  it('ثبت بدون پیش‌فاکتور رد می‌شود', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const withoutQuote = { ...BASE } as unknown as OrderRequest;
    await expect(
      gateway.submitOrderRequest(withoutQuote, { idempotencyKey: createIdempotencyKey() }),
    ).rejects.toMatchObject({ kind: 'validation' });
    expect(storedOrders()).toHaveLength(0);
  });

  it('مبلغ دیده‌شدهٔ دست‌کاری‌شده price_changed می‌گیرد و چیزی ثبت نمی‌شود', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    const tampered = { ...request, acceptedQuote: { ...request.acceptedQuote, total: 1 } };
    await expect(
      gateway.submitOrderRequest(tampered, { idempotencyKey: createIdempotencyKey() }),
    ).rejects.toMatchObject({ kind: 'price_changed' });
    expect(storedOrders()).toHaveLength(0);
  });

  it('پیش‌فاکتورِ انتخاب‌های دیگر برای این انتخاب‌ها پذیرفته نمی‌شود (price_changed)', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    await expect(
      gateway.submitOrderRequest({ ...request, hours: 7 }, { idempotencyKey: createIdempotencyKey() }),
    ).rejects.toMatchObject({ kind: 'price_changed' });
    expect(storedOrders()).toHaveLength(0);
  });

  it('پیش‌فاکتورِ انتخاب دیگر، حتی با مبلغ کاملاً یکسان، برای این انتخاب پذیرفته نمی‌شود', async () => {
    // نظافت استاندارد ۱۱ ساعت و مبل و فرش ۸ ساعت (بدون بستهٔ شوینده) هر دو ۱٬۷۶۰٬۰۰۰ تومان‌اند؛
    // پس فقط بررسی «همان انتخاب‌ها» می‌تواند جلوی پذیرش را بگیرد (یافتهٔ بازبینی PR #26).
    const { gateway } = createDemoOrderBackend(orderService);
    const standard = { ...BASE, serviceId: 'home-standard', hours: 11, addonIds: [], hasDetergentPackage: false, promoCode: undefined };
    const furniture = { ...standard, serviceId: 'furniture-carpet', hours: 8 };
    const standardQuote = await gateway.getQuote(standard);
    const furnitureQuote = await gateway.getQuote(furniture);
    expect(standardQuote.total).toBe(1_760_000);
    expect(furnitureQuote.total).toBe(standardQuote.total);

    const mismatched: OrderRequest = {
      ...furniture,
      acceptedQuote: { reference: standardQuote.reference, total: standardQuote.total },
    };
    await expect(
      gateway.submitOrderRequest(mismatched, { idempotencyKey: createIdempotencyKey() }),
    ).rejects.toMatchObject({ kind: 'price_changed' });
    expect(storedOrders()).toHaveLength(0);
  });

  it('ترتیب افزودنی‌ها یا شکل نوشتن کد تخفیف «انتخاب دیگر» حساب نمی‌شود', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const request = await quoted(gateway);
    const same = { ...request, addonIds: [...request.addonIds].reverse(), promoCode: ' pak1403 ' };
    await expect(
      gateway.submitOrderRequest(same, { idempotencyKey: createIdempotencyKey() }),
    ).resolves.toMatchObject({ total: 1_510_000 });
  });

  it('پیش‌فاکتور منقضی quote_expired می‌گیرد؛ با پیش‌فاکتور تازه ثبت ممکن است', async () => {
    const time = clock();
    const { gateway } = createDemoOrderBackend(orderService, { now: time.now });
    const stale = await quoted(gateway);
    time.advance(DEMO_QUOTE_TTL_MS);
    await expect(
      gateway.submitOrderRequest(stale, { idempotencyKey: createIdempotencyKey() }),
    ).rejects.toMatchObject({ kind: 'quote_expired' });

    const fresh = await quoted(gateway);
    await expect(
      gateway.submitOrderRequest(fresh, { idempotencyKey: createIdempotencyKey() }),
    ).resolves.toMatchObject({ total: 1_510_000 });
    expect(storedOrders()).toHaveLength(1);
  });

  it('مرجع ناشناخته (مثلاً پس از بارگذاری دوبارهٔ صفحه) quote_expired می‌گیرد', async () => {
    const { gateway } = createDemoOrderBackend(orderService);
    const unknown: OrderRequest = { ...BASE, acceptedQuote: { reference: 'DEMO-Q-unknown', total: 1_510_000 } };
    await expect(
      gateway.submitOrderRequest(unknown, { idempotencyKey: createIdempotencyKey() }),
    ).rejects.toMatchObject({ kind: 'quote_expired' });
  });

  it('تکرار همان ثبت با همان کلید پس از انقضای پیش‌فاکتور همان سفارش را برمی‌گرداند', async () => {
    const time = clock();
    const { gateway } = createDemoOrderBackend(orderService, { now: time.now });
    const request = await quoted(gateway);
    const options = { idempotencyKey: createIdempotencyKey() };
    const first = await gateway.submitOrderRequest(request, options);
    time.advance(DEMO_QUOTE_TTL_MS * 2);
    await expect(gateway.submitOrderRequest(request, options)).resolves.toEqual(first);
    expect(storedOrders()).toHaveLength(1);
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
        () => gateway.getQuote(BASE),
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

describe('هماهنگ‌کنندهٔ ثبت در لایهٔ اتصال', () => {
  const OTHER: OrderRequest = { ...REQUEST, notes: 'درخواست دیگر' };

  const scriptedGateway = (outcomes: Array<'ok' | 'unknown' | 'definitive'>) => {
    const sent: Array<{ request: OrderRequest; key: string }> = [];
    const gateway: CustomerOrderGateway = {
      getQuote: async () => {
        throw new OrderGatewayError('not_implemented', '');
      },
      submitOrderRequest: async (request, options) => {
        sent.push({ request, key: options.idempotencyKey });
        const outcome = outcomes[sent.length - 1] ?? 'ok';
        if (outcome === 'unknown') throw new OrderGatewayError('outcome_unknown', 'گم شد.');
        if (outcome === 'definitive') throw new OrderGatewayError('rate_limited', 'ثبت نشد.');
        return { trackingCode: `T-${sent.length}`, status: 'new', createdAt: '', total: 1, isProvisional: false };
      },
      trackOrder: async () => null,
    };
    return { gateway, sent };
  };

  it('تا روشن‌شدن نتیجهٔ نامشخص، درخواست متفاوت را نمی‌فرستد و همان درخواست را با همان کلید می‌فرستد', async () => {
    const { gateway, sent } = scriptedGateway(['unknown', 'ok']);
    const changes: Array<OrderRequest | null> = [];
    const coordinator = createSubmissionCoordinator(gateway, (value) => changes.push(value));

    await expect(coordinator.submit(REQUEST)).rejects.toMatchObject({ kind: 'outcome_unknown' });
    expect(coordinator.getUnresolved()).toEqual(REQUEST);

    await expect(coordinator.submit(OTHER)).rejects.toMatchObject({ kind: 'outcome_unknown' });
    expect(sent).toHaveLength(1);

    const receipt = await coordinator.submit({ ...REQUEST });
    expect(receipt.trackingCode).toBe('T-2');
    expect(sent).toHaveLength(2);
    expect(sent[1].key).toBe(sent[0].key);
    expect(coordinator.getUnresolved()).toBeNull();
    expect(changes).toEqual([REQUEST, null]);
  });

  it('پس از شکست قطعی قفل نمی‌کند: همان درخواست همان کلید و درخواست دیگر کلید تازه می‌گیرد', async () => {
    const { gateway, sent } = scriptedGateway(['definitive', 'definitive', 'ok']);
    const coordinator = createSubmissionCoordinator(gateway);

    await expect(coordinator.submit(REQUEST)).rejects.toMatchObject({ kind: 'rate_limited' });
    expect(coordinator.getUnresolved()).toBeNull();
    await expect(coordinator.submit(REQUEST)).rejects.toMatchObject({ kind: 'rate_limited' });
    await coordinator.submit(OTHER);

    expect(sent[1].key).toBe(sent[0].key);
    expect(sent[2].key).not.toBe(sent[0].key);
  });

  it('پیش‌فاکتور تازه یعنی درخواست تازه: کلید تکرار تازه می‌گیرد', async () => {
    const { gateway, sent } = scriptedGateway(['definitive', 'ok']);
    const coordinator = createSubmissionCoordinator(gateway);
    await expect(coordinator.submit(REQUEST)).rejects.toMatchObject({ kind: 'rate_limited' });
    await coordinator.submit({ ...REQUEST, acceptedQuote: { reference: 'TEST-QUOTE-2', total: 1 } });
    expect(sent[1].key).not.toBe(sent[0].key);
  });

  it('دو ثبت هم‌زمانِ همان درخواست فقط یک بار به adapter می‌رسد', async () => {
    const { gateway, sent } = scriptedGateway(['ok']);
    const coordinator = createSubmissionCoordinator(gateway);
    const [a, b] = await Promise.all([coordinator.submit(REQUEST), coordinator.submit({ ...REQUEST })]);
    expect(b).toEqual(a);
    expect(sent).toHaveLength(1);
  });

  it('فیلدهای خارج از قرارداد پیش از ارسال حذف می‌شوند', async () => {
    const { gateway, sent } = scriptedGateway(['ok']);
    const coordinator = createSubmissionCoordinator(gateway);
    await coordinator.submit({ ...REQUEST, totalPrice: 1, status: 'completed' } as unknown as OrderRequest);
    expect(sent[0].request).not.toHaveProperty('totalPrice');
    expect(sent[0].request).not.toHaveProperty('status');
    expect(sent[0].request.acceptedQuote).toEqual(REQUEST.acceptedQuote);
  });
});
