import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { argon2id, argon2Verify } from 'hash-wasm';
import { Secret, TOTP } from 'otpauth';

/**
 * احراز هویت مدیر — سند عملیاتی، بخش ۶.
 *
 * - رمز با argon2id (پیاده‌سازی WASM خالص `hash-wasm`، نه افزونهٔ نیتیو —
 *   همان دلیلی که `node:sqlite` به‌جای درایور نیتیو انتخاب شد: بدون کامپایل).
 * - TOTP با `otpauth` (بدون وابستگی نیتیو).
 * - ساخت حساب مدیر فقط از خط فرمان سرور است؛ این فایل آن مسیر (createAdmin)
 *   و مسیر ورود (verifyAdminCredentials) را هر دو صادر می‌کند؛ مسیر HTTP آن
 *   فقط دومی را صدا می‌زند.
 */

const ARGON2ID_OPTIONS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 19456, // ~19 MB — توصیهٔ OWASP برای argon2id با این پارامترها
  hashLength: 32,
  outputType: 'encoded',
};

const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS) || 2 * 60 * 60 * 1000; // ۲ ساعت

export const hashPassword = async (password) => {
  const salt = randomBytes(16);
  return argon2id({ password, salt, ...ARGON2ID_OPTIONS });
};

export const verifyPassword = async (password, hash) => {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
};

export const generateTotpSecret = () => new Secret({ size: 20 }).base32;

/** رشتهٔ otpauth:// برای واردکردن در اپ احرازهویت (Google Authenticator و مشابه) با اسکن یا تایپ دستی. */
export const buildTotpUri = (base32Secret, { issuer = 'Paksho', label = 'admin' } = {}) =>
  new TOTP({ issuer, label, algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(base32Secret) }).toString();

export const verifyTotp = (base32Secret, token) => {
  if (typeof token !== 'string' || !/^\d{6}$/.test(token)) return false;
  const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(base32Secret) });
  // window:1 یعنی یک بازهٔ ۳۰ ثانیه‌ای قبل/بعد هم پذیرفته می‌شود (لغزش ساعت).
  return totp.validate({ token, window: 1 }) !== null;
};

const timingSafeStringEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

export const createAdminAuth = (db) => {
  const findAdminByUsername = db.prepare('SELECT * FROM admins WHERE username = ?');
  const insertAdmin = db.prepare(`
    INSERT INTO admins (id, username, password_hash, totp_secret, created_at)
    VALUES (@id, @username, @passwordHash, @totpSecret, @createdAt)
  `);
  const touchLastLogin = db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?');

  const insertSession = db.prepare(`
    INSERT INTO admin_sessions (id, admin_id, csrf_token, created_at, expires_at)
    VALUES (@id, @adminId, @csrfToken, @createdAt, @expiresAt)
  `);
  const findSession = db.prepare('SELECT * FROM admin_sessions WHERE id = ?');
  const deleteSession = db.prepare('DELETE FROM admin_sessions WHERE id = ?');
  const deleteExpiredSessions = db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?');

  /** فقط از اسکریپت خط فرمان (server/scripts/createAdmin.js) صدا زده می‌شود. */
  const createAdmin = async ({ username, password, totpSecret }) => {
    if (findAdminByUsername.get(username)) {
      throw new Error(`حساب مدیر «${username}» از قبل وجود دارد.`);
    }
    const passwordHash = await hashPassword(password);
    const row = {
      id: randomUUID(),
      username,
      passwordHash,
      totpSecret,
      createdAt: new Date().toISOString(),
    };
    insertAdmin.run(row);
    return row;
  };

  /**
   * ورود: رمز و TOTP هر دو باید درست باشند. در صورت موفقیت نشست می‌سازد.
   * خطای نامشخص (نام کاربری غلط/رمز غلط/TOTP غلط) عمداً یک پیام یکسان می‌گیرد
   * تا نام‌های کاربری معتبر حدس‌پذیر نشوند.
   */
  const verifyAdminCredentials = async ({ username, password, totp }) => {
    const admin = typeof username === 'string' ? findAdminByUsername.get(username) : null;
    if (!admin || admin.disabled_at) {
      // همچنان یک هش بررسی می‌شود تا زمان پاسخ بین «کاربر نیست» و «رمز غلط» یکسان‌تر بماند.
      await verifyPassword(typeof password === 'string' ? password : '', ARGON2ID_DUMMY_HASH);
      return null;
    }

    const passwordOk = typeof password === 'string' && (await verifyPassword(password, admin.password_hash));
    const totpOk = passwordOk && verifyTotp(admin.totp_secret, totp);
    if (!passwordOk || !totpOk) return null;

    touchLastLogin.run(new Date().toISOString(), admin.id);
    return admin;
  };

  const createSession = (adminId) => {
    deleteExpiredSessions.run(new Date().toISOString());
    const now = new Date();
    const row = {
      id: randomUUID(),
      adminId,
      csrfToken: randomBytes(24).toString('base64url'),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    };
    insertSession.run(row);
    return row;
  };

  /** نشست معتبر (و منقضی‌نشده) را برمی‌گرداند یا null. */
  const getValidSession = (sessionId) => {
    if (typeof sessionId !== 'string' || !sessionId) return null;
    const session = findSession.get(sessionId);
    if (!session) return null;
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      deleteSession.run(sessionId);
      return null;
    }
    return session;
  };

  const revokeSession = (sessionId) => {
    if (typeof sessionId === 'string' && sessionId) deleteSession.run(sessionId);
  };

  const checkCsrfToken = (session, providedToken) =>
    typeof providedToken === 'string' && providedToken.length > 0 && timingSafeStringEqual(session.csrf_token, providedToken);

  return { createAdmin, verifyAdminCredentials, createSession, getValidSession, revokeSession, checkCsrfToken, SESSION_TTL_MS };
};

// یک هش argon2id ثابت و معتبر، فقط برای برابر نگه‌داشتن زمان پاسخ در مسیر «کاربر وجود ندارد».
const ARGON2ID_DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
