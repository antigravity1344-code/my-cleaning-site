import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * پایگاه‌دادهٔ SQLite حالت مستقل (ف۷: پایهٔ مشترک، حالت مستقل).
 *
 * از `node:sqlite` استفاده می‌شود (ماژول درون‌ساختهٔ Node ۲۲ به بعد؛ دقیقاً همان
 * چیزی که سرور اپ موبایل پاکشو هم استفاده می‌کند) تا هیچ وابستگی نیتیوِ قابل‌کامپایل
 * لازم نباشد.
 *
 * هر مهاجرت idempotent است (CREATE TABLE IF NOT EXISTS)، مطابق همان سبک dataStore.js
 * پاکشو.
 */
export const openDatabase = (filePath) => {
  if (filePath && filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath ?? ':memory:');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  runMigrations(db);
  return db;
};

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      tracking_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      status_updated_at TEXT NOT NULL,
      service_id TEXT NOT NULL,
      service_title TEXT NOT NULL,
      hours INTEGER NOT NULL,
      addon_ids_json TEXT NOT NULL,
      has_detergent_package INTEGER NOT NULL,
      promo_code TEXT,
      date TEXT,
      time_slot TEXT,
      city_name TEXT,
      district TEXT,
      address TEXT NOT NULL,
      unit TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      notes TEXT,
      pricing_version TEXT NOT NULL,
      service_base INTEGER NOT NULL,
      addons_total INTEGER NOT NULL,
      detergent_cost INTEGER NOT NULL,
      discount_total INTEGER NOT NULL,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash_on_site',
      idempotency_key TEXT NOT NULL UNIQUE,
      request_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT NOT NULL CHECK (actor IN ('customer', 'admin', 'system')),
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, created_at);

    CREATE TRIGGER IF NOT EXISTS order_events_no_update BEFORE UPDATE ON order_events
    BEGIN
      SELECT RAISE(ABORT, 'order_events is append-only');
    END;
    CREATE TRIGGER IF NOT EXISTS order_events_no_delete BEFORE DELETE ON order_events
    BEGIN
      SELECT RAISE(ABORT, 'order_events is append-only');
    END;
  `);
}
