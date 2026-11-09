import { afterEach, describe, expect, it, vi } from 'vitest';

// The module reads its base URL once at import time, so each case re-imports it.
async function loadWithBase(base: string) {
  vi.resetModules();
  vi.stubEnv('VITE_PAKSHO_API_BASE', base);
  return import('./pakshoApi');
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('pakshoApi', () => {
  it('sends nothing when no server is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const api = await loadWithBase('');
    expect(api.isPakshoConfigured()).toBe(false);
    await expect(api.requestQuote({ serviceId: 'hourly', quantity: 2 })).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests a quote anonymously and returns the signed token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      success: true,
      quote: { quoteToken: 'tok', total: 800000, currencyUnit: 'toman', expiresAt: '2030-01-01T00:00:00.000Z' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const api = await loadWithBase('https://paksho.example/');
    const quote = await api.requestQuote({ serviceId: 'hourly', quantity: 2 });
    expect(quote.quoteToken).toBe('tok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://paksho.example/api/pricing/quote');
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ serviceId: 'hourly', quantity: 2, options: {} });
  });

  it('sends the discount code with the quote and reads the site flags without login', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { success: true, quote: { quoteToken: 't', subtotal: 2000, surcharges: [], discounts: [], total: 1800, currencyUnit: 'toman', expiresAt: 'x' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, siteExtras: true, detergentPackage: false }));
    vi.stubGlobal('fetch', fetchMock);
    const api = await loadWithBase('https://paksho.example');
    await api.requestQuote({ serviceId: 'hourly', quantity: 2, discountCode: 'SAVE10' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).discountCode).toBe('SAVE10');
    const flags = await api.getSiteFeatures();
    expect(flags).toEqual({ siteExtras: true, detergentPackage: false });
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('verifies the OTP as a customer and returns the token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, token: 'session-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const api = await loadWithBase('https://paksho.example');
    await expect(api.verifyOtp('09120000001', '1234')).resolves.toBe('session-1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ phone: '09120000001', code: '1234', role: 'CUSTOMER' });
  });

  it('creates an order with the customer token and the confirmed total', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      success: true, order: { id: 'ORD-ABC-0a1b2c3d', status: 'PENDING', price: 800000, serviceTitle: 'نظافت', date: '۲۰ مهر', time: 'صبح' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const api = await loadWithBase('https://paksho.example');
    const order = await api.createOrder('session-1', {
      serviceId: 'hourly', quantity: 2, quoteToken: 'tok', confirmedTotal: 800000,
      address: 'تهران', date: '۲۰ مهر', time: 'صبح', customerName: 'الف', customerPhone: '09120000001',
      clientRequestId: 'req-0000001',
    });
    expect(order.id).toBe('ORD-ABC-0a1b2c3d');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer session-1');
    const sent = JSON.parse(init.body);
    expect(sent.confirmedTotal).toBe(800000);
    expect(sent.price).toBe(800000);
    expect(sent.quoteToken).toBe('tok');
  });

  it('turns server errors into PakshoApiError with the Persian message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(409, {
      success: false, code: 'PRICE_CHANGED', message: 'قیمت تغییر کرده است.',
    })));
    const api = await loadWithBase('https://paksho.example');
    await expect(api.requestQuote({ serviceId: 'hourly', quantity: 2 })).rejects.toMatchObject({
      status: 409, code: 'PRICE_CHANGED', message: 'قیمت تغییر کرده است.',
    });
  });

  it('returns null for an unknown tracking code and the summary for a known one', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(404, { success: false, code: 'NOT_FOUND', message: 'پیدا نشد' }))
      .mockResolvedValueOnce(jsonResponse(200, {
        success: true,
        order: { trackingCode: 'ORD-X-00000000', status: 'PENDING', serviceTitle: 'نظافت', date: null, time: null, area: 'تهران', createdAt: null },
      }));
    vi.stubGlobal('fetch', fetchMock);
    const api = await loadWithBase('https://paksho.example');
    await expect(api.trackOrder('ORD-MISSING')).resolves.toBeNull();
    const found = await api.trackOrder(' ORD-X-00000000 ');
    expect(found?.status).toBe('PENDING');
    expect(fetchMock.mock.calls[1][0]).toBe('https://paksho.example/api/track/ORD-X-00000000');
  });

  it('reports a network failure as a PakshoApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const api = await loadWithBase('https://paksho.example');
    await expect(api.sendOtp('09120000001')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
