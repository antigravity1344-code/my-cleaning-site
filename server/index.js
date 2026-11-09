import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { createStandaloneBackend } from './standaloneBackend.js';
import { createApp } from './app.js';

/**
 * نقطهٔ ورود سرور — انتخاب حالت (ف۷).
 *
 * BACKEND_MODE=standalone (پیش‌فرض): همین مخزن، بک‌اند و دیتابیس خودش.
 * BACKEND_MODE=coordinated: هنوز پیاده‌سازی نشده — عمداً، تا طراحی اتصال به
 * بک‌اند پاکشو (OPERATIONAL-PLAN.md بخش ۱۱) جداگانه تأیید شود.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mode = process.env.BACKEND_MODE ?? 'standalone';

if (mode !== 'standalone') {
  throw new Error(
    `BACKEND_MODE=${mode} هنوز پیاده‌سازی نشده است. فقط 'standalone' در این مرحله پشتیبانی می‌شود.`
  );
}

const dbPath = process.env.SITE_DB_PATH ?? path.join(__dirname, 'data', 'site.sqlite');
const db = openDatabase(dbPath);
const backend = createStandaloneBackend(db);
const app = createApp(backend);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[paksho-site-server] mode=${mode} listening on :${port} (db: ${dbPath})`);
});
