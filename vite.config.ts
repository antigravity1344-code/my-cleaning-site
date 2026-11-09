import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    // ف۶: سایت و API از یک دامنه سرو می‌شوند (در استقرار واقعی). در توسعهٔ
    // محلی، سرور Vite و `npm run server` روی پورت‌های جدا هستند، پس درخواست‌های
    // /api به سرور Express (پیش‌فرض :4000، با SITE_SERVER_PORT قابل‌تنظیم)
    // پراکسی می‌شوند — بدون این، کوکی نشست پنل مدیر به‌خاطر CORS/مبدأ متفاوت کار نمی‌کرد.
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.SITE_SERVER_PORT ?? 4000}`,
        changeOrigin: false,
      },
    },
  },
  test: {
    // The full-page render tests are slow on modest machines; the default 5 s limit made
    // otherwise-correct tests time out (different ones each run).
    testTimeout: 30000
  }
});
