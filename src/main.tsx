import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AdminApp } from './admin/AdminApp';
// فونت فارسی وزیرمتن (OFL-1.1) از خود سایت؛ فقط زیرمجموعه‌هایی که صفحه لازم دارد بارگذاری می‌شوند.
import '@fontsource-variable/vazirmatn';
import './index.css';

// پنل مدیر مسیر جدای خودش را دارد — بدون کتابخانهٔ مسیریاب (route)، چون کل
// سایت یک صفحه است و فقط همین یک مسیر دوم لازم بود. سرو کردن index.html
// برای مسیر /admin هم (SPA fallback) کار استقرار است، نه این فایل.
const isAdminRoute = window.location.pathname.startsWith('/admin');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isAdminRoute ? <AdminApp /> : <App />}</StrictMode>,
);
