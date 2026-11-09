import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminLogin, adminLogout, changeAdminOrderStatus, fetchAdminOrders, AdminApiError } from './adminApi';

/**
 * این آزمون‌ها مخصوصاً باگی را می‌گیرند که در آزمون سرتاسریِ دستی (با
 * Playwright) پیدا شد: ترتیب اشتباه spread در `request()` باعث می‌شد
 * `...options` بعد از `headers` بیاید و `options.headers` کل شیء headers
 * (و content-type پیش‌فرض) را پاک کند — در نتیجه بدنهٔ PATCH به‌صورت
 * text/plain فرستاده می‌شد و سرور آن را نمی‌خواند.
 */

const mockFetchOnce = (status: number, body: unknown, headersCheck?: (headers: HeadersInit | undefined) => void) => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    headersCheck?.(init?.headers);
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

describe('adminApi request()', () => {
  it('درخواست‌های با هدر اضافی (مثل PATCH با X-CSRF-Token) همچنان content-type: application/json دارند', async () => {
    const fetchMock = mockFetchOnce(200, { order: {}, events: [] }, (headers) => {
      const record = headers as Record<string, string>;
      expect(record['content-type']).toBe('application/json');
      expect(record['X-CSRF-Token']).toBe('csrf-abc');
    });

    await changeAdminOrderStatus('order-1', 'csrf-abc', 'confirmed', 'یادداشت');

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe(JSON.stringify({ status: 'confirmed', note: 'یادداشت' }));
  });

  it('GET بدون هدر اضافی هم content-type پیش‌فرض را دارد و متد/بدنه ندارد', async () => {
    const fetchMock = mockFetchOnce(200, { orders: [] }, (headers) => {
      expect((headers as Record<string, string>)['content-type']).toBe('application/json');
    });

    await fetchAdminOrders();

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBeUndefined();
    expect(init?.body).toBeUndefined();
  });

  it('login بدنهٔ JSON درست می‌فرستد', async () => {
    const fetchMock = mockFetchOnce(200, { csrfToken: 'tok', username: 'owner' });
    await adminLogin('owner', 'pw', '123456');
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ username: 'owner', password: 'pw', totp: '123456' }));
  });

  it('logout هدر X-CSRF-Token را می‌فرستد و content-type را از دست نمی‌دهد', async () => {
    const fetchMock = mockFetchOnce(200, { ok: true }, (headers) => {
      const record = headers as Record<string, string>;
      expect(record['content-type']).toBe('application/json');
      expect(record['X-CSRF-Token']).toBe('csrf-xyz');
    });
    await adminLogout('csrf-xyz');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('پاسخ ناموفق را به AdminApiError با field/message تبدیل می‌کند', async () => {
    mockFetchOnce(400, { field: 'status', message: 'تغییر وضعیت مجاز نیست.' });
    await expect(changeAdminOrderStatus('order-1', 'csrf', 'completed')).rejects.toMatchObject({
      status: 400,
      field: 'status',
      message: 'تغییر وضعیت مجاز نیست.',
    });
  });

  it('AdminApiError نمونه‌ای از Error است', async () => {
    mockFetchOnce(401, { message: 'ورود لازم است.' });
    try {
      await fetchAdminOrders();
      throw new Error('باید پرتاب می‌شد');
    } catch (error) {
      expect(error).toBeInstanceOf(AdminApiError);
    }
  });
});
