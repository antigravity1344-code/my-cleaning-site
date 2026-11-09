import express from 'express';
import { QuoteValidationError } from './pricingEngine.js';
import { createRateLimiter } from './rateLimiter.js';
import { buildExpiredCookie, buildSessionCookie, parseCookies } from './cookies.js';

const SESSION_COOKIE_NAME = 'admin_session';

// بخش ۶: «محدودیت تلاش ورود و قفل موقت». مقدار قابل‌تنظیم با متغیر محیطی.
const LOGIN_RATE_LIMIT_MAX = Number(process.env.ADMIN_LOGIN_RATE_LIMIT_MAX) || 10;
const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000;

/**
 * API مدیر — سند عملیاتی، بخش ۶ و ۱۵ (PR#4).
 *
 * `auth` خروجی `createAdminAuth(db)` است و `backend` همان بک‌اندِ سفارش
 * (standaloneBackend یا، در آینده، نسخهٔ هماهنگ) با متدهای
 * listOrdersForAdmin/getOrderForAdmin/changeOrderStatus.
 *
 * `cookieSecure` پرچم Secure کوکی نشست را کنترل می‌کند — در تولید باید true
 * باشد (فقط HTTPS)؛ برای توسعهٔ محلی بدون TLS با COOKIE_SECURE=false خاموش می‌شود.
 */
export const createAdminRouter = (auth, backend, { cookieSecure = process.env.COOKIE_SECURE !== 'false' } = {}) => {
  const router = express.Router();

  const loginRateLimiter = createRateLimiter({
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX,
    message: 'تلاش‌های ورود زیاد بوده؛ کمی بعد دوباره تلاش کنید.',
  });

  const requireSession = (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const session = auth.getValidSession(cookies[SESSION_COOKIE_NAME]);
    if (!session) {
      res.status(401).json({ message: 'ورود لازم است.' });
      return;
    }
    req.adminSession = session;
    next();
  };

  const requireCsrf = (req, res, next) => {
    const provided = req.get('X-CSRF-Token');
    if (!auth.checkCsrfToken(req.adminSession, provided)) {
      res.status(403).json({ message: 'توکن CSRF نامعتبر است.' });
      return;
    }
    next();
  };

  router.post('/login', loginRateLimiter, async (req, res) => {
    const { username, password, totp } = req.body ?? {};
    const admin = await auth.verifyAdminCredentials({ username, password, totp });
    if (!admin) {
      res.status(401).json({ message: 'نام کاربری، رمز یا کد یک‌بارمصرف نادرست است.' });
      return;
    }

    const session = auth.createSession(admin.id);
    res.set(
      'Set-Cookie',
      buildSessionCookie(SESSION_COOKIE_NAME, session.id, { maxAgeMs: auth.SESSION_TTL_MS, secure: cookieSecure })
    );
    res.json({ csrfToken: session.csrfToken, username: admin.username });
  });

  router.post('/logout', requireSession, requireCsrf, (req, res) => {
    auth.revokeSession(req.adminSession.id);
    res.set('Set-Cookie', buildExpiredCookie(SESSION_COOKIE_NAME, { secure: cookieSecure }));
    res.json({ ok: true });
  });

  router.get('/orders', requireSession, (_req, res) => {
    res.json({ orders: backend.listOrdersForAdmin() });
  });

  router.get('/orders/:id', requireSession, (req, res) => {
    const result = backend.getOrderForAdmin(req.params.id);
    if (!result) {
      res.status(404).json({ message: 'سفارش پیدا نشد.' });
      return;
    }
    res.json(result);
  });

  router.patch('/orders/:id', requireSession, requireCsrf, (req, res) => {
    try {
      const { status, note } = req.body ?? {};
      const result = backend.changeOrderStatus(req.params.id, { toStatus: status, note, actor: 'admin' });
      res.json(result);
    } catch (error) {
      if (error instanceof QuoteValidationError) {
        res.status(error.statusCode ?? 400).json({ field: error.field, message: error.message });
        return;
      }
      // eslint-disable-next-line no-console
      console.error(error);
      res.status(500).json({ message: 'خطای داخلی سرور.' });
    }
  });

  return router;
};
