import express from 'express';
import { QuoteValidationError } from './pricingEngine.js';

/**
 * اسکلت سرور سایت — سند عملیاتی بخش ۱۵، PR#2.
 *
 * فقط دو مسیر در این مرحله: POST /api/quotes و POST /api/orders. مسیر پیگیری
 * (GET /api/track/:code)، پنل مدیر و محدودیت نرخ عمداً اینجا نیستند — طبق
 * ترتیب خودِ سند، PRهای بعدی‌اند.
 *
 * `backend` یک شیء با {createQuote, createOrder} است (از standaloneBackend.js
 * یا، در آینده، پیاده‌سازی «حالت هماهنگ»). این فایل از جزئیات پیاده‌سازی بک‌اند
 * بی‌خبر است — دقیقاً همان جداییِ لازم برای دو‌حالته بودن (ف۷).
 */
export const createApp = (backend) => {
  const app = express();
  app.use(express.json());

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
