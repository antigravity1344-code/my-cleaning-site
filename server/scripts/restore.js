#!/usr/bin/env node
import { restoreBackup, readEncryptionKey, BackupError } from '../backupEngine.js';

/**
 * بازیابی دستی از پشتیبان — سند عملیاتی، بخش ۹ (PR#6).
 *
 * استفاده:
 *   BACKUP_ENCRYPTION_KEY=<64 hex> node server/scripts/restore.js --file <backup.sqlite.enc> --out <مسیر-خروجی.sqlite>
 *
 * این اسکریپت هرگز روی مسیر خروجیِ از پیش موجود رونویسی نمی‌کند — برای
 * جلوگیری از پاک کردن ناخواستهٔ پایگاه دادهٔ زنده، همیشه به یک مسیر تازه
 * (مثلاً یک کپی برای بازرسی، یا یک محیط تمیز طبق بخش ۹) بازیابی کنید؛ بعد
 * از تأیید صحت، خودتان آن را جای `SITE_DB_PATH` بگذارید.
 *
 * دستورالعمل کامل بازیابی روی محیط تمیز: docs/RESTORE_INSTRUCTIONS.fa.md
 */

const parseArgs = (argv) => {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--file') out.file = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || !args.out) {
    console.error('استفاده: node server/scripts/restore.js --file <backup.sqlite.enc> --out <مسیر-خروجی.sqlite>');
    process.exitCode = 1;
    return;
  }

  let key;
  try {
    key = readEncryptionKey(process.env);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  try {
    const { outputPath, bytes } = restoreBackup({ backupFilePath: args.file, outputPath: args.out, key });
    console.log(`بازیابی موفق بود: ${outputPath} (${bytes} بایت)`);
    console.log('بررسی یکپارچگی (PRAGMA integrity_check) گذرانده شد.');
  } catch (error) {
    if (error instanceof BackupError) {
      console.error(`بازیابی ناموفق بود: ${error.message}`);
    } else {
      console.error('خطای غیرمنتظره در بازیابی:', error);
    }
    process.exitCode = 1;
  }
}

main();
