import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * موتور پشتیبان‌گیری/بازیابی — سند عملیاتی، بخش ۹ (PR#6).
 *
 * «پشتیبان روزانه و خودکار، رمزگذاری‌شده، بیرون از سرور اصلی، ۳۰ نسخهٔ آخر.»
 *
 * طراحی:
 * - عکس لحظه‌ای سازگار با `VACUUM INTO` خودِ SQLite گرفته می‌شود (نه کپی فایل
 *   خام، که با WAL فعال می‌تواند ناقص باشد). `VACUUM INTO` یک فایل تازه و
 *   یکپارچه می‌سازد، حتی وقتی نوشتن هم‌زمان در جریان است.
 * - فایل حاصل با AES-256-GCM رمزگذاری می‌شود (`node:crypto`، بدون وابستگی
 *   بیرونی — همان استدلال انتخاب `node:sqlite` در db.js و `hash-wasm`/`otpauth`
 *   در adminAuth.js: کمترین وابستگی قابل‌کامپایل).
 * - کلید رمزگذاری فقط از متغیر محیطی `BACKUP_ENCRYPTION_KEY` خوانده می‌شود
 *   (۶۴ نویسهٔ hex = ۳۲ بایت)؛ هرگز در کد یا مخزن نیست.
 * - پوشهٔ مقصد پیش‌فرض از `server/data` (جایی که پایگاه دادهٔ زنده است) جداست؛
 *   در استقرار واقعی باید `BACKUP_DIR` به ذخیره‌سازی واقعاً جدا اشاره کند.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12; // توصیهٔ خودِ node:crypto برای GCM.
const MAGIC = Buffer.from('PAKSHOBK1'); // شناسهٔ فرمت فایل + نسخه، برای رد فایل‌های ناسازگار.

export class BackupError extends Error {}

/** `BACKUP_ENCRYPTION_KEY` را به بافر ۳۲بایتی تبدیل می‌کند؛ نبود/نامعتبر بودن آن خطای واضح می‌دهد. */
export function readEncryptionKey(env = process.env) {
  const raw = env.BACKUP_ENCRYPTION_KEY;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new BackupError(
      'BACKUP_ENCRYPTION_KEY تنظیم نشده است. یک کلید ۶۴ نویسه‌ای hex (۳۲ بایت) تولید و در محیط امن ذخیره کنید؛ مثال: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  const trimmed = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new BackupError('BACKUP_ENCRYPTION_KEY باید دقیقاً ۶۴ نویسهٔ hex (۳۲ بایت) باشد.');
  }
  return Buffer.from(trimmed, 'hex');
}

/** نام فایل پشتیبان با برچسب زمانی قابل‌مرتب‌سازی (ISO بدون کاراکتر غیرمجاز در نام فایل). */
export function backupFileName(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `site-backup-${stamp}.sqlite.enc`;
}

/**
 * یک عکس لحظه‌ای سازگار از پایگاه داده می‌گیرد (VACUUM INTO)، رمزگذاری
 * می‌کند و در `backupDir` می‌نویسد. فایل میانی غیررمزگذاری همیشه پاک می‌شود،
 * حتی در صورت خطا.
 *
 * @returns {{ filePath: string, bytes: number }}
 */
export function createBackup({ dbPath, backupDir, key, now = new Date() }) {
  if (!fs.existsSync(dbPath)) {
    throw new BackupError(`پایگاه دادهٔ منبع یافت نشد: ${dbPath}`);
  }
  fs.mkdirSync(backupDir, { recursive: true });

  const tmpSnapshotPath = path.join(backupDir, `.tmp-snapshot-${process.pid}-${Date.now()}.sqlite`);
  // VACUUM INTO روی دیتابیس منبع (فقط-خواندنی از دید این عملیات) اجرا می‌شود.
  const sourceDb = new DatabaseSync(dbPath, { readOnly: true });
  try {
    sourceDb.exec(`VACUUM INTO '${tmpSnapshotPath.replace(/'/g, "''")}'`);
  } finally {
    sourceDb.close();
  }

  try {
    const plainBytes = fs.readFileSync(tmpSnapshotPath);
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plainBytes), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // قالب فایل: MAGIC(9) | IV(12) | authTag(16) | محتوای رمزشده.
    const output = Buffer.concat([MAGIC, iv, authTag, encrypted]);
    const fileName = backupFileName(now);
    const filePath = path.join(backupDir, fileName);
    fs.writeFileSync(filePath, output, { mode: 0o600 });
    return { filePath, bytes: output.length };
  } finally {
    fs.rmSync(tmpSnapshotPath, { force: true });
  }
}

/**
 * فایل‌های `site-backup-*.sqlite.enc` در `backupDir` را بر اساس نام (که با
 * برچسب زمانی ISO مرتب است) می‌شمارد و فقط `keep` نسخهٔ آخر را نگه می‌دارد.
 * @returns {string[]} نام فایل‌های حذف‌شده.
 */
export function pruneOldBackups(backupDir, keep = 30) {
  if (!fs.existsSync(backupDir)) return [];
  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.startsWith('site-backup-') && name.endsWith('.sqlite.enc'))
    .sort(); // برچسب زمانی ISO در نام فایل، مرتب‌سازی رشته‌ای = مرتب‌سازی زمانی.
  const toRemove = files.length > keep ? files.slice(0, files.length - keep) : [];
  for (const name of toRemove) {
    fs.rmSync(path.join(backupDir, name), { force: true });
  }
  return toRemove;
}

/**
 * یک فایل پشتیبان رمزشده را رمزگشایی و در `outputPath` می‌نویسد (پایگاه دادهٔ
 * معمولی SQLite، قابل باز شدن با `openDatabase`). هرگز مسیر مبدا را رونویسی
 * نمی‌کند؛ فراخوان مسئول انتخاب مسیر خروجی امن است.
 */
export function restoreBackup({ backupFilePath, outputPath, key }) {
  if (!fs.existsSync(backupFilePath)) {
    throw new BackupError(`فایل پشتیبان یافت نشد: ${backupFilePath}`);
  }
  if (fs.existsSync(outputPath)) {
    throw new BackupError(`مسیر خروجی از قبل وجود دارد و رونویسی نمی‌شود: ${outputPath}. مسیر دیگری انتخاب کنید.`);
  }
  const raw = fs.readFileSync(backupFilePath);
  if (raw.length < MAGIC.length + IV_BYTES + 16) {
    throw new BackupError('فایل پشتیبان خراب یا ناقص است (حجم کمتر از حداقل مجاز).');
  }
  const magic = raw.subarray(0, MAGIC.length);
  if (!magic.equals(MAGIC)) {
    throw new BackupError('فرمت فایل پشتیبان شناخته‌شده نیست (نشان MAGIC نامعتبر).');
  }
  let offset = MAGIC.length;
  const iv = raw.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const authTag = raw.subarray(offset, offset + 16);
  offset += 16;
  const encrypted = raw.subarray(offset);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let plain;
  try {
    plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch (error) {
    // GCM یعنی کلید نادرست یا دستکاری محتوا هر دو همین‌جا رد می‌شوند.
    throw new BackupError('رمزگشایی ناموفق بود — کلید نادرست است یا فایل پشتیبان دستکاری/خراب شده.');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, plain, { mode: 0o600 });

  // تأیید یکپارچگی: فایل بازیابی‌شده باید یک SQLite سالم و قابل‌باز شدن باشد.
  const check = new DatabaseSync(outputPath, { readOnly: true });
  try {
    const result = check.prepare('PRAGMA integrity_check').get();
    const status = result && result.integrity_check;
    if (status !== 'ok') {
      throw new BackupError(`بررسی یکپارچگی پایگاه دادهٔ بازیابی‌شده ناموفق بود: ${status}`);
    }
  } finally {
    check.close();
  }

  return { outputPath, bytes: plain.length };
}
