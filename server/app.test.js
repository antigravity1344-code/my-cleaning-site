import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TOTP, Secret } from 'otpauth';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { createStandaloneBackend } from './standaloneBackend.js';
import { createAdminAuth, generateTotpSecret } from './adminAuth.js';
import { createAdminRouter } from './adminRouter.js';

/**
 * آزمون‌های یکپارچه‌سازی — سند عملیاتی، بخش ۱۵ (PR#2).
 * هر آزمون با یک سرور HTTP تازه (پورت تصادفی) و دیتابیس SQLite در حافظه اجرا می‌شود.
 */

let server;
let baseUrl;
let adminUsername;
let adminPassword;
let adminTotpSecret;

beforeEach(async () => {
  const db = openDatabase(':memory:');
  const backend = createStandaloneBackend(db);
  const adminAuth = createAdminAuth(db);
  const adminRouter = createAdminRouter(adminAuth, backend, { cookieSecure: false });
  const app = createApp(backend, { adminRouter });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  adminUsername = 'owner';
  adminPassword = 'a-very-strong-password-1';
  adminTotpSecret = generateTotpSecret();
  await adminAuth.createAdmin({ username: adminUsername, password: adminPassword, totpSecret: adminTotpSecret });
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const post = (path, body, headers = {}) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const validOrderInput = {
  serviceId: 'home-standard',
  hours: 4,
  addonIds: ['windows'],
  address: 'تهران، خیابان ولیعصر، پلاک ۱۰',
  customerName: 'علی رضایی',
  customerPhone: '09121234567',
};

describe('GET /api/health', () => {
  it('۲۰۰ و ok:true برمی‌گرداند', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('POST /api/quotes', () => {
  it('پیش‌فاکتور معتبر را محاسبه می‌کند و چیزی ذخیره نمی‌کند', async () => {
    const res = await post('/api/quotes', { serviceId: 'home-standard', hours: 4 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(160000 * 4);
    expect(body.pricingVersion).toBe('v1-demo-data');
  });

  it('ورودی نامعتبر را با ۴۰۰ و field/message رد می‌کند', async () => {
    const res = await post('/api/quotes', { serviceId: 'ghost', hours: 4 });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe('serviceId');
    expect(typeof body.message).toBe('string');
  });

  it('بدنهٔ JSON نامعتبر را ۴۰۰ می‌دهد، نه ۵۰۰', async () => {
    const res = await fetch(`${baseUrl}/api/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid json',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/orders', () => {
  it('بدون Idempotency-Key رد می‌شود', async () => {
    const res = await post('/api/orders', validOrderInput);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe('idempotencyKey');
  });

  it('سفارش معتبر را با کلید یکتا ثبت می‌کند (۲۰۱)', async () => {
    const res = await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-aaa-111' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.trackingCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(body.status).toBe('new');
    expect(body.total).toBeGreaterThan(0);
  });

  it('همان کلید + همان محتوا → همان سفارش، idempotent (۲۰۰)', async () => {
    const first = await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-bbb-222' });
    const firstBody = await first.json();

    const second = await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-bbb-222' });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.trackingCode).toBe(firstBody.trackingCode);
  });

  it('همان کلید + محتوای متفاوت → ۴۰۹', async () => {
    await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-ccc-333' });
    const res = await post('/api/orders', { ...validOrderInput, hours: 5 }, { 'Idempotency-Key': 'key-ccc-333' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.field).toBe('idempotencyKey');
  });

  it('ورودی قیمتی نامعتبر را حتی با کلید معتبر رد می‌کند', async () => {
    const res = await post(
      '/api/orders',
      { ...validOrderInput, hours: 999 },
      { 'Idempotency-Key': 'key-ddd-444' }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe('hours');
  });

  it('بدون آدرس/نام/شماره معتبر رد می‌شود', async () => {
    const res = await post(
      '/api/orders',
      { serviceId: 'home-standard', hours: 4, address: '  ', customerName: '', customerPhone: '09121234567' },
      { 'Idempotency-Key': 'key-eee-555' }
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/track/:code', () => {
  it('کد معتبر را با اطلاعات محدود برمی‌گرداند (بدون نام/آدرس/تلفن)', async () => {
    const created = await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-track-111' });
    const order = await created.json();

    const res = await fetch(`${baseUrl}/api/track/${order.trackingCode}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      serviceTitle: order.serviceTitle,
      date: null,
      timeSlot: null,
      cityName: null,
      status: 'new',
      statusUpdatedAt: expect.any(String),
    });
    expect(body.customerName).toBeUndefined();
    expect(body.address).toBeUndefined();
    expect(body.customerPhone).toBeUndefined();
  });

  it('کد ناموجود ۴۰۴ عمومی می‌دهد', async () => {
    const res = await fetch(`${baseUrl}/api/track/ZZZZ-ZZZZ-ZZZZ-ZZZZ`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(typeof body.message).toBe('string');
  });

  it('کد بدشکل همان پاسخ کد ناموجود را می‌دهد (بخش ۷: پاسخ یکسان)', async () => {
    const notFound = await fetch(`${baseUrl}/api/track/ZZZZ-ZZZZ-ZZZZ-ZZZZ`);
    const malformed = await fetch(`${baseUrl}/api/track/not-a-real-code`);
    expect(malformed.status).toBe(notFound.status);
    expect(await malformed.json()).toEqual(await notFound.json());
  });

  it('کد با حروف کوچک هم پیدا می‌شود (نرمال‌سازی حروف بزرگ)', async () => {
    const created = await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-track-222' });
    const order = await created.json();

    const res = await fetch(`${baseUrl}/api/track/${order.trackingCode.toLowerCase()}`);
    expect(res.status).toBe(200);
  });

  it('بعد از عبور از سقف محدودیت نرخ ۴۲۹ می‌دهد', async () => {
    let lastStatus;
    for (let i = 0; i < 21; i += 1) {
      const res = await fetch(`${baseUrl}/api/track/ZZZZ-ZZZZ-ZZZZ-ZZZZ`);
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

const currentTotp = () =>
  new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(adminTotpSecret) }).generate();

const sessionCookieFrom = (res) => {
  const setCookie = res.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] : null;
};

const loginAsAdmin = async () => {
  const res = await post('/api/admin/login', { username: adminUsername, password: adminPassword, totp: currentTotp() });
  const body = await res.json();
  const cookie = sessionCookieFrom(res);
  return { status: res.status, cookie, csrfToken: body.csrfToken };
};

describe('POST /api/admin/login', () => {
  it('ورود صحیح یک کوکی نشست و csrfToken می‌دهد', async () => {
    const { status, cookie, csrfToken } = await loginAsAdmin();
    expect(status).toBe(200);
    expect(cookie).toMatch(/^admin_session=/);
    expect(typeof csrfToken).toBe('string');
    expect(csrfToken.length).toBeGreaterThan(0);
  });

  it('رمز نادرست ۴۰۱ می‌دهد', async () => {
    const res = await post('/api/admin/login', { username: adminUsername, password: 'wrong', totp: currentTotp() });
    expect(res.status).toBe(401);
  });

  it('TOTP نادرست حتی با رمز درست ۴۰۱ می‌دهد', async () => {
    const res = await post('/api/admin/login', { username: adminUsername, password: adminPassword, totp: '000000' });
    expect(res.status).toBe(401);
  });

  it('نام کاربری ناموجود هم همان ۴۰۱ را می‌دهد (بدون افشای وجود حساب)', async () => {
    const res = await post('/api/admin/login', { username: 'ghost', password: 'whatever12345', totp: '000000' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/session', () => {
  it('بدون نشست ۴۰۱ می‌دهد', async () => {
    const res = await fetch(`${baseUrl}/api/admin/session`);
    expect(res.status).toBe(401);
  });

  it('با نشست معتبر همان csrfToken را دوباره می‌دهد', async () => {
    const { cookie, csrfToken } = await loginAsAdmin();
    const res = await fetch(`${baseUrl}/api/admin/session`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.csrfToken).toBe(csrfToken);
  });
});

describe('Admin API — دسترسی و سفارش‌ها', () => {
  it('بدون ورود، مسیرهای مدیر ۴۰۱ می‌دهند', async () => {
    const list = await fetch(`${baseUrl}/api/admin/orders`);
    expect(list.status).toBe(401);
    const detail = await fetch(`${baseUrl}/api/admin/orders/whatever`);
    expect(detail.status).toBe(401);
  });

  it('با نشست معتبر، سفارش جدید در فهرست مدیر با اطلاعات کامل دیده می‌شود', async () => {
    const created = await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-admin-111' });
    const order = await created.json();

    const { cookie } = await loginAsAdmin();
    const res = await fetch(`${baseUrl}/api/admin/orders`, { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.orders.find((o) => o.trackingCode === order.trackingCode);
    expect(found).toBeDefined();
    expect(found.customerName).toBe(validOrderInput.customerName);
    expect(found.address).toBe(validOrderInput.address);
    expect(found.customerPhone).toBe(validOrderInput.customerPhone);
  });

  it('تغییر وضعیت مجاز (new → confirmed) را اعمال می‌کند و رویداد ثبت می‌کند', async () => {
    const created = await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-admin-222' });
    const order = await created.json();

    const { cookie, csrfToken } = await loginAsAdmin();
    const listRes = await fetch(`${baseUrl}/api/admin/orders`, { headers: { Cookie: cookie } });
    const { orders } = await listRes.json();
    const orderId = orders.find((o) => o.trackingCode === order.trackingCode).id;

    const patchRes = await fetch(`${baseUrl}/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'X-CSRF-Token': csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed', note: 'تماس گرفته شد' }),
    });
    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.order.status).toBe('confirmed');
    expect(body.events.at(-1)).toMatchObject({ fromStatus: 'new', toStatus: 'confirmed', actor: 'admin', note: 'تماس گرفته شد' });
  });

  it('تغییر وضعیت غیرمجاز (new → completed) را رد می‌کند', async () => {
    const created = await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-admin-333' });
    const order = await created.json();

    const { cookie, csrfToken } = await loginAsAdmin();
    const listRes = await fetch(`${baseUrl}/api/admin/orders`, { headers: { Cookie: cookie } });
    const { orders } = await listRes.json();
    const orderId = orders.find((o) => o.trackingCode === order.trackingCode).id;

    const patchRes = await fetch(`${baseUrl}/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'X-CSRF-Token': csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(patchRes.status).toBe(400);
  });

  it('تغییر وضعیت بدون توکن CSRF درست رد می‌شود (۴۰۳)', async () => {
    const created = await post('/api/orders', validOrderInput, { 'Idempotency-Key': 'key-admin-444' });
    const order = await created.json();

    const { cookie } = await loginAsAdmin();
    const listRes = await fetch(`${baseUrl}/api/admin/orders`, { headers: { Cookie: cookie } });
    const { orders } = await listRes.json();
    const orderId = orders.find((o) => o.trackingCode === order.trackingCode).id;

    const patchRes = await fetch(`${baseUrl}/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'X-CSRF-Token': 'wrong-token', 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(patchRes.status).toBe(403);
  });

  it('بعد از خروج (logout)، نشست دیگر معتبر نیست', async () => {
    const { cookie, csrfToken } = await loginAsAdmin();

    const logoutRes = await fetch(`${baseUrl}/api/admin/logout`, {
      method: 'POST',
      headers: { Cookie: cookie, 'X-CSRF-Token': csrfToken },
    });
    expect(logoutRes.status).toBe(200);

    const afterLogout = await fetch(`${baseUrl}/api/admin/orders`, { headers: { Cookie: cookie } });
    expect(afterLogout.status).toBe(401);
  });
});
