#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../db.js';
import { createAdminAuth, generateTotpSecret, buildTotpUri } from '../adminAuth.js';

/**
 * ساخت حساب مدیر — فقط از خط فرمان سرور (سند عملیاتی، بخش ۶: «ثبت‌نام عمومی
 * وجود ندارد»). هیچ مسیر HTTP حساب مدیر نمی‌سازد.
 *
 * استفاده:
 *   ADMIN_USERNAME=... ADMIN_PASSWORD=... node server/scripts/createAdmin.js
 * یا:
 *   node server/scripts/createAdmin.js --username ... --password ...
 *
 * رمز عبور حداقل ۱۲ نویسه باید باشد. بعد از اجرا، رشتهٔ otpauth:// و کد
 * Base32 چاپ می‌شود — آن را در یک اپ احرازهویت (Google Authenticator و
 * مشابه) وارد کنید؛ دوباره چاپ یا در پایگاه داده قابل‌بازیابی نیست.
 */

const parseArgs = (argv) => {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--username') out.username = argv[++i];
    else if (argv[i] === '--password') out.password = argv[++i];
  }
  return out;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const username = args.username ?? process.env.ADMIN_USERNAME;
  const password = args.password ?? process.env.ADMIN_PASSWORD;

  if (!username || typeof username !== 'string' || !username.trim()) {
    console.error('نام کاربری لازم است: --username یا ADMIN_USERNAME');
    process.exitCode = 1;
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 12) {
    console.error('رمز عبور لازم است و باید حداقل ۱۲ نویسه باشد: --password یا ADMIN_PASSWORD');
    process.exitCode = 1;
    return;
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dbPath = process.env.SITE_DB_PATH ?? path.join(__dirname, '..', 'data', 'site.sqlite');
  const db = openDatabase(dbPath);
  const auth = createAdminAuth(db);

  const totpSecret = generateTotpSecret();

  try {
    await auth.createAdmin({ username: username.trim(), password, totpSecret });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const uri = buildTotpUri(totpSecret, { label: username.trim() });
  console.log(`حساب مدیر «${username.trim()}» ساخته شد.`);
  console.log('');
  console.log('این کد TOTP را همین الان در اپ احرازهویت (Google Authenticator یا مشابه) وارد کنید؛');
  console.log('دوباره نمایش داده نمی‌شود:');
  console.log('');
  console.log(`  رمز Base32: ${totpSecret}`);
  console.log(`  رشتهٔ otpauth: ${uri}`);
}

main();
