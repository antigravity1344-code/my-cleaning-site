// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from './App';

/**
 * آزمون دود: کل درخت اپ باید بدون خطای زمان اجرا رندر شود و افشاگری
 * «حالت آزمایشی» در بالای صفحه حاضر باشد.
 */

afterEach(cleanup);

describe('App — رندر کامل و افشاگری حالت آزمایشی', () => {
  it('کل اپ بدون خطا رندر می‌شود', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('نوار هشدار حالت آزمایشی نمایش داده می‌شود', () => {
    const { container } = render(<App />);
    expect(container.textContent).toContain('نسخه آزمایشی');
    expect(container.textContent).toContain('متخصصی اعزام نمی‌شود');
    expect(container.textContent).toContain('پرداخت آنلاین فعال نیست');
  });

  it('هیچ ادعای عملیاتی تأییدنشده‌ای در صفحه اصلی باقی نمانده است', () => {
    const { container } = render(<App />);
    const text = container.textContent ?? '';

    // ادعاهای حذف‌شده در این مأموریت
    expect(text).not.toContain('گارانتی ۱۰۰٪ رضایت');
    expect(text).not.toContain('تضمین ۱۰۰٪ کیفیت');
    expect(text).not.toContain('۲۵,۰۰۰ خانواده');
    expect(text).not.toContain('نماد اعتماد الکترونیکی وزارت');
    expect(text).not.toContain('تحت پوشش بیمه مسئولیت مدنی ایران');
    expect(text).not.toContain('اعزام فوری ۲ ساعته');
  });

  it('بخش‌های اصلی سایت همچنان موجودند (قابلیتی حذف نشده است)', () => {
    const { container } = render(<App />);
    const text = container.textContent ?? '';

    expect(text).toContain('نظافت استاندارد منزل');
    expect(text).toContain('برآورد هزینه');
    expect(text).toContain('متخصصین نمونه');
    expect(text).toContain('نمونه نظرات');
    expect(text).toContain('سوالات متداول');
  });
});
