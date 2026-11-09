import { afterEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  BackupError,
  backupFileName,
  createBackup,
  pruneOldBackups,
  readEncryptionKey,
  restoreBackup,
} from './backupEngine.js';

const tmpDirs = [];
const makeTmpDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paksho-backup-test-'));
  tmpDirs.push(dir);
  return dir;
};

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const KEY_HEX = crypto.randomBytes(32).toString('hex');

const makeSourceDb = (dir, seedRow = 'سلام') => {
  const dbPath = path.join(dir, 'source.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE orders (id INTEGER PRIMARY KEY, note TEXT)');
  db.prepare('INSERT INTO orders (note) VALUES (?)').run(seedRow);
  db.close();
  return dbPath;
};

describe('readEncryptionKey', () => {
  it('کلید ۶۴نویسه‌ای hex را به بافر ۳۲بایتی تبدیل می‌کند', () => {
    const key = readEncryptionKey({ BACKUP_ENCRYPTION_KEY: KEY_HEX });
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('بدون متغیر محیطی خطای BackupError می‌دهد', () => {
    expect(() => readEncryptionKey({})).toThrow(BackupError);
  });

  it('کلید با طول نادرست را رد می‌کند', () => {
    expect(() => readEncryptionKey({ BACKUP_ENCRYPTION_KEY: 'abcd' })).toThrow(BackupError);
  });
});

describe('backupFileName', () => {
  it('نام فایل قابل‌مرتب‌سازی با پسوند .sqlite.enc می‌سازد', () => {
    const name = backupFileName(new Date('2026-11-09T10:00:00.000Z'));
    expect(name).toBe('site-backup-2026-11-09T10-00-00-000Z.sqlite.enc');
  });
});

describe('createBackup + restoreBackup — چرخهٔ کامل', () => {
  it('عکس لحظه‌ای را رمزگذاری می‌کند و بازیابی همان داده را برمی‌گرداند', () => {
    const dir = makeTmpDir();
    const dbPath = makeSourceDb(dir, 'سفارش آزمایشی برای بکاپ');
    const backupDir = path.join(dir, 'backups');
    const key = readEncryptionKey({ BACKUP_ENCRYPTION_KEY: KEY_HEX });

    const { filePath, bytes } = createBackup({ dbPath, backupDir, key });
    expect(fs.existsSync(filePath)).toBe(true);
    expect(bytes).toBeGreaterThan(0);
    // فایل میانی غیررمزگذاری نباید باقی بماند.
    const leftoverTmp = fs.readdirSync(backupDir).filter((name) => name.startsWith('.tmp-snapshot-'));
    expect(leftoverTmp).toEqual([]);

    const restoredPath = path.join(dir, 'restored.sqlite');
    const { outputPath } = restoreBackup({ backupFilePath: filePath, outputPath: restoredPath, key });
    expect(outputPath).toBe(restoredPath);

    const restoredDb = new DatabaseSync(restoredPath, { readOnly: true });
    try {
      const row = restoredDb.prepare('SELECT note FROM orders LIMIT 1').get();
      expect(row.note).toBe('سفارش آزمایشی برای بکاپ');
    } finally {
      restoredDb.close();
    }
  });

  it('با کلید نادرست رمزگشایی را رد می‌کند (BackupError)', () => {
    const dir = makeTmpDir();
    const dbPath = makeSourceDb(dir);
    const backupDir = path.join(dir, 'backups');
    const key = readEncryptionKey({ BACKUP_ENCRYPTION_KEY: KEY_HEX });
    const { filePath } = createBackup({ dbPath, backupDir, key });

    const wrongKey = readEncryptionKey({ BACKUP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex') });
    expect(() =>
      restoreBackup({ backupFilePath: filePath, outputPath: path.join(dir, 'should-not-exist.sqlite'), key: wrongKey })
    ).toThrow(BackupError);
  });

  it('فایل پشتیبان دستکاری‌شده (authTag نامعتبر) را رد می‌کند', () => {
    const dir = makeTmpDir();
    const dbPath = makeSourceDb(dir);
    const backupDir = path.join(dir, 'backups');
    const key = readEncryptionKey({ BACKUP_ENCRYPTION_KEY: KEY_HEX });
    const { filePath } = createBackup({ dbPath, backupDir, key });

    const bytes = fs.readFileSync(filePath);
    bytes[bytes.length - 1] ^= 0xff; // یک بایت از انتهای محتوای رمزشده را خراب می‌کند.
    fs.writeFileSync(filePath, bytes);

    expect(() =>
      restoreBackup({ backupFilePath: filePath, outputPath: path.join(dir, 'tampered-out.sqlite'), key })
    ).toThrow(BackupError);
  });

  it('روی مسیر خروجی از قبل موجود رونویسی نمی‌کند', () => {
    const dir = makeTmpDir();
    const dbPath = makeSourceDb(dir);
    const backupDir = path.join(dir, 'backups');
    const key = readEncryptionKey({ BACKUP_ENCRYPTION_KEY: KEY_HEX });
    const { filePath } = createBackup({ dbPath, backupDir, key });

    const existingPath = path.join(dir, 'already-here.sqlite');
    fs.writeFileSync(existingPath, 'نگه‌دار');

    expect(() => restoreBackup({ backupFilePath: filePath, outputPath: existingPath, key })).toThrow(BackupError);
    expect(fs.readFileSync(existingPath, 'utf8')).toBe('نگه‌دار');
  });

  it('فایل پشتیبان ناموجود، خطای روشن می‌دهد', () => {
    const dir = makeTmpDir();
    const key = readEncryptionKey({ BACKUP_ENCRYPTION_KEY: KEY_HEX });
    expect(() =>
      restoreBackup({ backupFilePath: path.join(dir, 'missing.sqlite.enc'), outputPath: path.join(dir, 'out.sqlite'), key })
    ).toThrow(BackupError);
  });

  it('پایگاه دادهٔ منبع ناموجود، خطای روشن می‌دهد', () => {
    const dir = makeTmpDir();
    const key = readEncryptionKey({ BACKUP_ENCRYPTION_KEY: KEY_HEX });
    expect(() => createBackup({ dbPath: path.join(dir, 'missing.sqlite'), backupDir: path.join(dir, 'backups'), key })).toThrow(
      BackupError
    );
  });
});

describe('pruneOldBackups', () => {
  it('فقط آخرین N نسخه را نگه می‌دارد و قدیمی‌ترها را حذف می‌کند', () => {
    const dir = makeTmpDir();
    const backupDir = path.join(dir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const names = [];
    for (let i = 0; i < 5; i += 1) {
      const name = `site-backup-2026-11-0${i}T00-00-00-000Z.sqlite.enc`;
      fs.writeFileSync(path.join(backupDir, name), 'x');
      names.push(name);
    }
    // یک فایل نامرتبط که نباید لمس شود.
    fs.writeFileSync(path.join(backupDir, 'unrelated.txt'), 'x');

    const removed = pruneOldBackups(backupDir, 3);
    expect(removed.sort()).toEqual([names[0], names[1]].sort());

    const remaining = fs.readdirSync(backupDir).filter((n) => n.endsWith('.sqlite.enc'));
    expect(remaining.sort()).toEqual([names[2], names[3], names[4]].sort());
    expect(fs.existsSync(path.join(backupDir, 'unrelated.txt'))).toBe(true);
  });

  it('روی پوشهٔ ناموجود خطا نمی‌دهد، فهرست خالی برمی‌گرداند', () => {
    const dir = makeTmpDir();
    const removed = pruneOldBackups(path.join(dir, 'does-not-exist'), 30);
    expect(removed).toEqual([]);
  });
});
