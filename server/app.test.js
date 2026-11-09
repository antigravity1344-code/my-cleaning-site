import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { createStandaloneBackend } from './standaloneBackend.js';

/**
 * آزمون‌های یکپارچه‌سازی — سند عملیاتی، بخش ۱۵ (PR#2).
 * هر آزمون با یک سرور HTTP تازه (پورت تصادفی) و دیتابیس SQLite در حافظه اجرا می‌شود.
 */

let server;
let baseUrl;

beforeEach(async () => {
  const db = openDatabase(':memory:');
  const backend = createStandaloneBackend(db);
  const app = createApp(backend);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
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
