import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * فونت فارسی سایت باید همراه خود سایت سرو شود، نه از سرور گوگل.
 *
 * اگر fonts.googleapis.com برای بازدیدکننده کند یا در دسترس نباشد، کل سایت با فونت
 * جایگزین سیستم (مثلاً DejaVu Sans) نمایش داده می‌شود؛ هر بازدید هم نشانی IP کاربر را
 * به گوگل می‌فرستد. این آزمون‌ها جلوی برگشتن آن وابستگی را می‌گیرند.
 */

const read = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('فونت وزیرمتن همراه سایت سرو می‌شود', () => {
  it('index.html هیچ پیوندی به Google Fonts ندارد', () => {
    const html = read('../index.html');
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  it('فایل‌های فونت از بسته‌ی محلی وارد برنامه می‌شوند', () => {
    expect(read('./main.tsx')).toMatch(/import '@fontsource-variable\/vazirmatn';/);
    const pkg = JSON.parse(read('../package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@fontsource-variable/vazirmatn']).toBeTruthy();
  });

  it('نخستین فونت صفحه همان فونت محلی است', () => {
    const css = read('./index.css');
    expect(css).toMatch(/font-family:\s*'Vazirmatn Variable'/);
  });
});
