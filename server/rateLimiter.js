/**
 * محدودیت نرخ ساده، در حافظه — سند عملیاتی، بخش ۵ و ۷.
 *
 * بدون وابستگی خارجی (Redis و مشابه) چون این فاز هنوز روی یک پردازه اجرا
 * می‌شود. اگر بعداً سرور پشت چند نمونه (instance) اجرا شود، این باید با یک
 * فروشگاه مشترک (مثل Redis) جایگزین شود — این محدودیت همین‌جا مستند است.
 *
 * شمارندهٔ پنجرهٔ ثابت (fixed window) به‌ازای هر کلید (پیش‌فرض IP درخواست).
 */
export const createRateLimiter = ({ windowMs, max, message, keyFn }) => {
  const hits = new Map();

  const resolveKey = keyFn ?? ((req) => req.ip);

  // جلوگیری از نشت حافظه: هر چند صدتا درخواست، ورودی‌های منقضی را پاک کن.
  const sweep = () => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  };

  return (req, res, next) => {
    const key = resolveKey(req);
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      res.status(429).json({ message: message ?? 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.' });
      return;
    }

    if (hits.size > 500) sweep();
    next();
  };
};
