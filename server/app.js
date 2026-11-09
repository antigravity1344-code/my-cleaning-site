import express from 'express';
import { QuoteValidationError } from './pricingEngine.js';
import { createRateLimiter } from './rateLimiter.js';

/**
 * اسکلت سرور سایت — سند عملیاتی بخش ۱۵، PR#2 و PR#3.
 *
 * مسیرها تا این مرحله: POST /api/quotes، POST /api/orders و
 * GET /api/track/:code (با محدودیت نرخ). پنل مدیر عمداً اینجا نیست — طبق
 * ترتیب خودِ سند، PR بعدی است.
 *
 * `backend` یک شیء با {createQuote, createOrder, trackOrder} است (از
 * standaloneBackend.js یا، در آینده، پیاده‌سازی «حالت هماهنگ»). این فایل از
 * جزئیات پیاده‌سازی بک‌اند بی‌خبر است — دقیقاً همان جداییِ لازم برای دو‌حالته
 * بودن (ف۷).
 */

// بخش ۷: «مثلاً ۲۰ بار در ساعت برای هر IP». با متغیر محیطی قابل‌تنظیم است.
const TRACK_RATE_LIMIT_MAX = Number(process.env.TRACK_RATE_LIMIT_MAX) || 20;
const TRACK_RATE_LIMIT_WINDOW_MS = Number(process.env.TRACK_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000;

export const createApp = (backend) => {
  const app = express();
  app.use(express.json());

  const trackRateLimiter = createRateLimiter({
    windowMs: TRACK_RATE_LIMIT_WINDOW_MS,
    max: TRACK_RATE_LIMIT_MAX,
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/quotes', (req, res) => {
    try {
      const quote = backend.createQuote(req.body);
      res.json(quote);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/orders', (req, res) => {
    const idempotencyKey = req.get('Idempotency-Key');
    try {
      const { order, idempotent } = backend.createOrder(req.body, idempotencyKey);
      res.status(idempotent ? 200 : 201).json(order);
    } catch (error) {
      handleError(res, error);
    }
  });

  // بخش ۷: کد ناموجود و کد نامعتبر پاسخ یکسان می‌گیرند (۴۰۴ عمومی)، تا
  // حدس‌زدن کدهای معتبر از روی تفاوت پاسخ‌ها سخت‌تر شود.
  app.get('/api/track/:code', trackRateLimiter, (req, res) => {
    const result = backend.trackOrder(req.params.code);
    if (!result) {
      res.status(404).json({ message: 'سفارشی با این کد پیدا نشد.' });
      return;
    }
    res.json(result);
  });

  // بدنهٔ JSON نامعتبر (express.json) هم باید ۴۰۰ بدهد، نه ۵۰۰.
  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ field: 'body', message: 'بدنهٔ درخواست JSON معتبر نیست.' });
    }
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).json({ message: 'خطای داخلی سرور.' });
  });

  return app;
};

function handleError(res, error) {
  if (error instanceof QuoteValidationError) {
    const statusCode = error.statusCode ?? 400;
    res.status(statusCode).json({ field: error.field, message: error.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ message: 'خطای داخلی سرور.' });
}
