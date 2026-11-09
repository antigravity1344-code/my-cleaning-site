#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackup, pruneOldBackups, readEncryptionKey, BackupError } from '../backupEngine.js';

/**
 * پشتیبان‌گیری دستی/زمان‌بندی‌شده — سند عملیاتی، بخش ۹ (PR#6).
 *
 * استفاده:
 *   BACKUP_ENCRYPTION_KEY=<64 hex> node server/scripts/backup.js
 *
 * متغیرهای محیطی:
 *   SITE_DB_PATH          مسیر پایگاه دادهٔ زنده (پیش‌فرض: server/data/site.sqlite)
 *   BACKUP_DIR            مسیر پوشهٔ پشتیبان (پیش‌فرض: backups/ کنار server/data،
 *                          یعنی server/backups؛ در استقرار واقعی باید به ذخیره‌سازی
 *                          واقعاً جدا از سرور اصلی اشاره کند)
 *   BACKUP_ENCRYPTION_KEY کلید رمزگذاری، ۶۴ نویسهٔ hex (الزامی)
 *   BACKUP_KEEP           تعداد نسخهٔ نگه‌داشته‌شده (پیش‌فرض ۳۰، طبق سند عملیاتی)
 *
 * برای اجرای روزانهٔ خودکار، این اسکریپت را با cron یا زمان‌بند معادل در
 * محیط استقرار صدا بزنید؛ خودش زمان‌بندی نمی‌کند.
 */

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dbPath = process.env.SITE_DB_PATH ?? path.join(__dirname, '..', 'data', 'site.sqlite');
  const backupDir = process.env.BACKUP_DIR ?? path.join(__dirname, '..', 'backups');
  const keep = Number(process.env.BACKUP_KEEP) || 30;

  let key;
  try {
    key = readEncryptionKey(process.env);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  try {
    const { filePath, bytes } = createBackup({ dbPath, backupDir, key });
    console.log(`پشتیبان ساخته شد: ${filePath} (${bytes} بایت)`);

    const removed = pruneOldBackups(backupDir, keep);
    if (removed.length > 0) {
      console.log(`${removed.length} نسخهٔ قدیمی‌تر از آخرین ${keep} نسخه حذف شد: ${removed.join(', ')}`);
    }
  } catch (error) {
    if (error instanceof BackupError) {
      console.error(`پشتیبان‌گیری ناموفق بود: ${error.message}`);
    } else {
      console.error('خطای غیرمنتظره در پشتیبان‌گیری:', error);
    }
    process.exitCode = 1;
  }
}

main();
