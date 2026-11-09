import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from './db.js';
import {
  buildTotpUri,
  createAdminAuth,
  generateTotpSecret,
  hashPassword,
  verifyPassword,
  verifyTotp,
} from './adminAuth.js';
import { TOTP, Secret } from 'otpauth';

describe('hashPassword / verifyPassword', () => {
  it('هش و تأیید درست کار می‌کند', async () => {
    const hash = await hashPassword('a-very-strong-password-1');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('a-very-strong-password-1', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('هر بار نمک متفاوت تولید می‌کند (هش یکسان نیست)', async () => {
    const h1 = await hashPassword('same-password-123');
    const h2 = await hashPassword('same-password-123');
    expect(h1).not.toBe(h2);
  });
});

describe('TOTP', () => {
  it('توکن معتبر از همان راز تأیید می‌شود', () => {
    const secret = generateTotpSecret();
    const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const token = totp.generate();
    expect(verifyTotp(secret, token)).toBe(true);
  });

  it('توکن نادرست رد می‌شود', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('مقدار بدشکل (غیر ۶ رقمی) رد می‌شود', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, undefined)).toBe(false);
  });

  it('buildTotpUri یک otpauth:// معتبر می‌سازد', () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, { label: 'owner' });
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(secret);
  });
});

describe('createAdminAuth', () => {
  let db;
  let auth;

  beforeEach(() => {
    db = openDatabase(':memory:');
    auth = createAdminAuth(db);
  });

  const makeTotp = (secret) => new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) });

  it('createAdmin حساب می‌سازد و تکراری را رد می‌کند', async () => {
    const totpSecret = generateTotpSecret();
    await auth.createAdmin({ username: 'owner', password: 'a-very-strong-password-1', totpSecret });
    await expect(
      auth.createAdmin({ username: 'owner', password: 'another-password-2', totpSecret: generateTotpSecret() })
    ).rejects.toThrow();
  });

  it('verifyAdminCredentials با رمز و TOTP درست موفق می‌شود', async () => {
    const totpSecret = generateTotpSecret();
    await auth.createAdmin({ username: 'owner', password: 'a-very-strong-password-1', totpSecret });
    const token = makeTotp(totpSecret).generate();

    const admin = await auth.verifyAdminCredentials({ username: 'owner', password: 'a-very-strong-password-1', totp: token });
    expect(admin).not.toBeNull();
    expect(admin.username).toBe('owner');
  });

  it('رمز نادرست null می‌دهد', async () => {
    const totpSecret = generateTotpSecret();
    await auth.createAdmin({ username: 'owner', password: 'a-very-strong-password-1', totpSecret });
    const token = makeTotp(totpSecret).generate();
    const admin = await auth.verifyAdminCredentials({ username: 'owner', password: 'wrong', totp: token });
    expect(admin).toBeNull();
  });

  it('TOTP نادرست حتی با رمز درست null می‌دهد', async () => {
    const totpSecret = generateTotpSecret();
    await auth.createAdmin({ username: 'owner', password: 'a-very-strong-password-1', totpSecret });
    const admin = await auth.verifyAdminCredentials({ username: 'owner', password: 'a-very-strong-password-1', totp: '000000' });
    expect(admin).toBeNull();
  });

  it('نام کاربری ناموجود null می‌دهد (بدون خطا)', async () => {
    const admin = await auth.verifyAdminCredentials({ username: 'ghost', password: 'x', totp: '123456' });
    expect(admin).toBeNull();
  });

  it('حساب غیرفعال‌شده نمی‌تواند وارد شود', async () => {
    const totpSecret = generateTotpSecret();
    await auth.createAdmin({ username: 'owner', password: 'a-very-strong-password-1', totpSecret });
    db.prepare("UPDATE admins SET disabled_at = ? WHERE username = 'owner'").run(new Date().toISOString());
    const token = makeTotp(totpSecret).generate();
    const admin = await auth.verifyAdminCredentials({ username: 'owner', password: 'a-very-strong-password-1', totp: token });
    expect(admin).toBeNull();
  });

  it('createSession / getValidSession / revokeSession', async () => {
    const totpSecret = generateTotpSecret();
    const row = await auth.createAdmin({ username: 'owner', password: 'a-very-strong-password-1', totpSecret });

    const session = auth.createSession(row.id);
    expect(auth.getValidSession(session.id)).not.toBeNull();

    auth.revokeSession(session.id);
    expect(auth.getValidSession(session.id)).toBeNull();
  });

  it('نشست منقضی‌شده دیگر معتبر نیست', async () => {
    const totpSecret = generateTotpSecret();
    const row = await auth.createAdmin({ username: 'owner', password: 'a-very-strong-password-1', totpSecret });
    const session = auth.createSession(row.id);

    db.prepare('UPDATE admin_sessions SET expires_at = ? WHERE id = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      session.id
    );

    expect(auth.getValidSession(session.id)).toBeNull();
  });

  it('checkCsrfToken فقط توکن درست را می‌پذیرد', async () => {
    const totpSecret = generateTotpSecret();
    const row = await auth.createAdmin({ username: 'owner', password: 'a-very-strong-password-1', totpSecret });
    const session = auth.createSession(row.id);
    const dbSession = auth.getValidSession(session.id);

    expect(auth.checkCsrfToken(dbSession, session.csrfToken)).toBe(true);
    expect(auth.checkCsrfToken(dbSession, 'wrong-token')).toBe(false);
    expect(auth.checkCsrfToken(dbSession, '')).toBe(false);
  });
});
