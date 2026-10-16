import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// فونت فارسی وزیرمتن (OFL-1.1) از خود سایت؛ فقط زیرمجموعه‌هایی که صفحه لازم دارد بارگذاری می‌شوند.
import '@fontsource-variable/vazirmatn';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
