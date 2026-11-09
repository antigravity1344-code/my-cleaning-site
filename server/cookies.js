/**
 * کمک‌کنندهٔ کوچک کوکی — فقط برای کوکی نشست مدیر لازم است، پس به‌جای
 * `cookie-parser` یک پیاده‌سازی تک‌منظورهٔ کوچک اینجاست.
 */

export const parseCookies = (cookieHeader) => {
  const result = {};
  if (typeof cookieHeader !== 'string' || !cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) result[name] = decodeURIComponent(value);
  }
  return result;
};

/**
 * سند عملیاتی، بخش ۶: کوکی `HttpOnly`، `Secure` و `SameSite=Strict`.
 * `secure` با COOKIE_SECURE=false در توسعهٔ محلی (http بدون TLS) قابل خاموش‌کردن است.
 */
export const buildSessionCookie = (name, value, { maxAgeMs, secure }) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (secure) parts.push('Secure');
  if (typeof maxAgeMs === 'number') parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  return parts.join('; ');
};

export const buildExpiredCookie = (name, { secure }) => {
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
};
