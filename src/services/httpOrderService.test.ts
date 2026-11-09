import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpOrderService, HttpOrderServiceError } from './httpOrderService';
import { CreateOrderDTO } from './orderService.types';

const mockFetchOnce = (
  status: number,
  body: unknown,
  check?: (url: string, init: RequestInit | undefined) => void
) => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    check?.(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const sampleDto: CreateOrderDTO = {
  serviceId: 'home-standard',
  serviceTitle: 'نظافت استاندارد منزل',
  cleanerGender: 'no-pref',
  hours: 4,
  selectedAddons: ['windows'],
  hasDetergentPackage: false,
  date: '1405/08/20',
  timeSlot: 'صبح',
  cityName: 'تهران',
  district: 'ولیعصر',
  address: 'خیابان ولیعصر، پلاک ۱',
  unit: '۳',
  customerName: 'علی رضایی',
  customerPhone: '09121234567',
  totalPrice: 640000,
  discountApplied: 0,
  paymentMethod: 'cash_on_site',
};

describe('httpOrderService.createOrder', () => {
  it('POST /api/orders را با Idempotency-Key و content-type درست می‌فرستد', async () => {
    const fetchMock = mockFetchOnce(
      201,
      {
        trackingCode: 'ABCD-EFGH-IJKL-MNOP',
        status: 'new',
        serviceId: 'home-standard',
        serviceTitle: 'نظافت استاندارد منزل',
        hours: 4,
        total: 770000,
        createdAt: '2026-11-09T10:00:00.000Z',
      },
      (url, init) => {
        expect(url).toBe('/api/orders');
        const headers = init?.headers as Record<string, string>;
        expect(headers['content-type']).toBe('application/json');
        expect(typeof headers['Idempotency-Key']).toBe('string');
        expect(headers['Idempotency-Key'].length).toBeGreaterThan(0);
      }
    );

    const order = await httpOrderService.createOrder(sampleDto);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(order.trackingCode).toBe('ABCD-EFGH-IJKL-MNOP');
    expect(order.status).toBe('new');
    // مبلغ معتبر همان مبلغ سرور است، نه مبلغ محاسبه‌شدهٔ مرورگر.
    expect(order.totalPrice).toBe(770000);
    expect(order.customerName).toBe('علی رضایی');
    expect(order.isPublicSummary).toBeUndefined();
  });

  it('دو فراخوانی، دو Idempotency-Key متفاوت می‌سازند', async () => {
    const seen: string[] = [];
    mockFetchOnce(
      201,
      { trackingCode: 'X', status: 'new', serviceId: 'x', serviceTitle: 'x', hours: 1, total: 1, createdAt: 'x' },
      (_url, init) => seen.push((init?.headers as Record<string, string>)['Idempotency-Key'])
    );
    await httpOrderService.createOrder(sampleDto);

    mockFetchOnce(
      201,
      { trackingCode: 'Y', status: 'new', serviceId: 'x', serviceTitle: 'x', hours: 1, total: 1, createdAt: 'x' },
      (_url, init) => seen.push((init?.headers as Record<string, string>)['Idempotency-Key'])
    );
    await httpOrderService.createOrder(sampleDto);

    expect(seen[0]).not.toBe(seen[1]);
  });

  it('خطای سرور را به HttpOrderServiceError با پیام فارسی تبدیل می‌کند', async () => {
    mockFetchOnce(400, { field: 'hours', message: 'تعداد ساعت نامعتبر است.' });
    await expect(httpOrderService.createOrder(sampleDto)).rejects.toThrow('تعداد ساعت نامعتبر است.');
    await expect(httpOrderService.createOrder(sampleDto)).rejects.toBeInstanceOf(HttpOrderServiceError);
  });
});

describe('httpOrderService.getOrderByTrackingCode', () => {
  it('پاسخ عمومی را به BookingOrder محدود (isPublicSummary) نگاشت می‌کند', async () => {
    mockFetchOnce(200, {
      serviceTitle: 'نظافت استاندارد منزل',
      date: '1405/08/20',
      timeSlot: 'صبح',
      cityName: 'تهران',
      status: 'confirmed',
      statusUpdatedAt: '2026-11-09T10:05:00.000Z',
    });

    const order = await httpOrderService.getOrderByTrackingCode('ABCD-EFGH-IJKL-MNOP');
    expect(order).not.toBeNull();
    expect(order?.isPublicSummary).toBe(true);
    expect(order?.status).toBe('confirmed');
    expect(order?.serviceTitle).toBe('نظافت استاندارد منزل');
    // فیلدهای مالی/تماس در پاسخ عمومی نیستند؛ نباید اطلاعات واقعی فرض شوند.
    expect(order?.customerName).toBe('');
    expect(order?.address).toBe('');
    expect(order?.totalPrice).toBe(0);
  });

  it('کد ناموجود/نامعتبر (۴۰۴) را null می‌کند، نه خطا', async () => {
    mockFetchOnce(404, { message: 'سفارشی با این کد پیدا نشد.' });
    const order = await httpOrderService.getOrderByTrackingCode('ZZZZ-ZZZZ-ZZZZ-ZZZZ');
    expect(order).toBeNull();
  });

  it('رشتهٔ خالی را بدون فراخوانی شبکه null می‌کند', async () => {
    const fetchMock = mockFetchOnce(200, {});
    const order = await httpOrderService.getOrderByTrackingCode('   ');
    expect(order).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('httpOrderService — بدون حساب مشتری و بدون لغو آنلاین', () => {
  it('getOrders فهرست خالی می‌دهد (بدون درخواست شبکه)', async () => {
    const fetchMock = mockFetchOnce(200, {});
    expect(await httpOrderService.getOrders()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getOrderById همیشه null می‌دهد', async () => {
    const fetchMock = mockFetchOnce(200, {});
    expect(await httpOrderService.getOrderById('any-id')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submitOrderRating رد می‌شود (مسیر سرور ندارد)', async () => {
    await expect(httpOrderService.submitOrderRating('order-1', 5)).rejects.toBeInstanceOf(HttpOrderServiceError);
  });

  it('cancelOrder رد می‌شود و پیام راهنما می‌دهد (لغو فقط با تماس)', async () => {
    await expect(httpOrderService.cancelOrder('order-1')).rejects.toThrow(/تماس/);
  });
});
