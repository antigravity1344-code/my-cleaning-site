// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { calculatePrice } from './pricing/pricingEngine';
import { DEMO_STORAGE_KEY, LEGACY_STORAGE_KEYS } from './services/pii';

/**
 * یافته ۴ مأموریت PAKSHO-WEBSITE-SAFETY-003 — آزمون مسیر واقعی App.
 *
 * آزمون‌های `components/bookingFlow.test.tsx` دو کامپوننت را جداگانه رندر می‌کنند و
 * داده را دستی منتقل می‌کنند؛ بنابراین «مسیر واقعی App.tsx» را اجرا نمی‌کنند.
 * این فایل کل `<App />` را رندر می‌کند و از دکمه واقعی محاسبه‌گر تا فاکتور فرم رزرو
 * را با همان هندلرهای App.tsx می‌پیماید.
 *
 * محدوده اثبات: این آزمون برای ورودی‌های آزمون‌شده نشان می‌دهد مبلغ محاسبه‌گر و
 * مبلغ فاکتور یکسان است. اثبات «عدم امکان ساختاری واگرایی» را ارائه نمی‌کند؛
 * تنها راه رسیدن به فاکتور در App همین مسیر است، اما تضمین ریاضی برای همه
 * ورودی‌های ممکن ارائه نمی‌شود.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const toPersianDigits = (value: number): string => value.toLocaleString('fa-IR');

/** مبلغ کارت برآورد را فقط داخل بخش محاسبه‌گر می‌خواند (نه از کل صفحه). */
const readCalculatorTotal = (): string => {
  const section = document.querySelector('#calculator');
  if (!section) throw new Error('بخش محاسبه‌گر (#calculator) در DOM پیدا نشد.');
  const node = section.querySelector('.text-3xl');
  if (!node?.textContent) throw new Error('مبلغ محاسبه‌گر در DOM پیدا نشد.');
  return node.textContent.trim();
};

/** ریشه مودال رزرو که App واقعاً باز کرده است. */
const getBookingModal = (): HTMLElement => {
  const modal = document.querySelector('div.fixed.inset-0.z-50');
  if (!modal) throw new Error('مودال رزرو توسط App باز نشد.');
  return modal as HTMLElement;
};

/** مبلغ فاکتور (مرحله ۴) را فقط داخل مودال رزرو می‌خواند. */
const readInvoiceTotal = (): string => {
  const modal = getBookingModal();
  const node = modal.querySelector('.text-2xl');
  if (!node?.textContent) throw new Error('مبلغ فاکتور در مودال رزرو پیدا نشد.');
  return node.textContent.trim();
};

/** کاربر را داخل مودالِ بازشده توسط App تا مرحله فاکتور پیش می‌برد. */
const goToInvoiceStep = (): void => {
  const modal = getBookingModal();
  for (let step = 0; step < 3; step += 1) {
    fireEvent.click(within(modal, /مرحله بعد/));
  }
  fireEvent.change(screen.getByPlaceholderText('مثال: سارا محمدی'), {
    target: { value: 'کاربر آزمایشی' },
  });
  fireEvent.change(screen.getByPlaceholderText('0912xxxxxxx'), {
    target: { value: '09123456789' },
  });
  fireEvent.change(screen.getByPlaceholderText(/بلوار دریا/), {
    target: { value: 'خیابان نمونه، پلاک ۱' },
  });
  fireEvent.click(within(getBookingModal(), /مرحله بعد/));
};

/** دکمه‌ای با نام مشخص را داخل یک ریشه می‌جوید. */
function within(root: HTMLElement, name: RegExp): HTMLElement {
  const buttons = Array.from(root.querySelectorAll('button'));
  const match = buttons.find((button) => name.test(button.textContent ?? ''));
  if (!match) throw new Error(`دکمه‌ای با نام ${String(name)} داخل ریشه پیدا نشد.`);
  return match;
}

describe('مسیر واقعی App — محاسبه‌گر تا فاکتور رزرو', () => {
  it('App با ورودی‌های پیش‌فرض، همان مبلغ محاسبه‌گر را در فاکتور نشان می‌دهد', () => {
    render(<App />);

    const calculatorTotal = readCalculatorTotal();

    // کلیک روی دکمه واقعی محاسبه‌گر؛ هندلر App.tsx باید مودال را باز کند.
    fireEvent.click(screen.getByRole('button', { name: /ادامه در فرم آزمایشی رزرو/ }));
    expect(document.querySelector('div.fixed.inset-0.z-50')).not.toBeNull();

    goToInvoiceStep();

    expect(readInvoiceTotal()).toBe(calculatorTotal);
  });

  it('برای ورودی‌های تغییر یافته (متراژ، اتاق و افزودنی) در App نیز مبلغ‌ها یکسان می‌مانند', () => {
    render(<App />);

    const section = document.querySelector('#calculator') as HTMLElement;

    // متراژ را تغییر می‌دهیم تا ساعت پیشنهادی و در نتیجه مبلغ بازمحاسبه شود.
    const slider = section.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '220' } });

    // تعداد اتاق خواب را از دکمه‌های همان بخش تغییر می‌دهیم.
    const roomButton = Array.from(section.querySelectorAll('button')).find(
      (button) => (button.textContent ?? '').trim() === '4',
    );
    if (!roomButton) throw new Error('دکمه تعداد اتاق ۴ در محاسبه‌گر پیدا نشد.');
    fireEvent.click(roomButton);

    // و یک خدمت جانبی اضافه می‌کنیم.
    fireEvent.click(screen.getAllByText('شستشوی کامل شیشه‌ها و بالکن')[0]);

    const calculatorTotal = readCalculatorTotal();

    // ساعت پیشنهادی از متن همان بخش خوانده می‌شود تا کنترل متقابل ممکن باشد.
    const hoursMatch = (section.textContent ?? '').match(/(\d+)\s*ساعت کاری/);
    if (!hoursMatch) throw new Error('ساعت پیشنهادی در محاسبه‌گر پیدا نشد.');
    const recommendedHours = Number(hoursMatch[1]);

    fireEvent.click(screen.getByRole('button', { name: /ادامه در فرم آزمایشی رزرو/ }));
    goToInvoiceStep();

    const invoiceTotal = readInvoiceTotal();
    expect(invoiceTotal).toBe(calculatorTotal);

    // کنترل متقابل: خروجی همان موتور قیمت‌گذاری مشترک با ورودی‌های خام تغییر‌یافته
    const engineTotal = calculatePrice({
      serviceId: 'home-standard',
      hours: recommendedHours,
      addonIds: ['windows'],
      hasDetergentPackage: true,
    }).total;
    expect(invoiceTotal).toBe(toPersianDigits(engineTotal));
  });

  it('هیچ مبلغی از مرورگر به‌عنوان «مبلغ قابل پرداخت» ذخیره یا منتقل نمی‌شود', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /ادامه در فرم آزمایشی رزرو/ }));
    goToInvoiceStep();

    const modal = getBookingModal();
    expect(modal.textContent).toContain('مبلغ پیشنهادی (آزمایشی)');
    expect(modal.textContent).not.toContain('مبلغ قابل پرداخت');
    expect(modal.textContent).not.toContain('پرداخت اینترنتی امن');
  });

  it('پیش از تأیید نهایی، هیچ سفارشی در حافظه ذخیره نمی‌شود', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /ادامه در فرم آزمایشی رزرو/ }));
    goToInvoiceStep();

    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });

  it('ثبت واقعی سفارش از مسیر App: مقدار ذخیره‌شده بدون اطلاعات خام و بدون آسیب به داده قدیمی', async () => {
    // داده ساختگی نسخه قبلی (کلید قدیمی) — باید دست‌نخورده بماند.
    const legacyKey = LEGACY_STORAGE_KEYS[0];
    const legacyValue = JSON.stringify([
      { id: 'legacy-1', customerPhone: '۰۹۳۵۰۰۰۱۱۲۲', address: 'بلوار پاکنژاد، پلاک ۱۲' },
    ]);
    localStorage.setItem(legacyKey, legacyValue);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /ادامه در فرم آزمایشی رزرو/ }));
    goToInvoiceStep();

    fireEvent.click(within(getBookingModal(), /تایید نهایی و ثبت سفارش/));

    // انتظار برای تکمیل ثبت نمایشی
    await vi.waitFor(() => {
      expect(localStorage.getItem(DEMO_STORAGE_KEY)).not.toBeNull();
    });

    const stored = localStorage.getItem(DEMO_STORAGE_KEY) ?? '';

    // ۱) هیچ فیلد بازخورد و هیچ شماره/نشانی خامی در مقدار واقعی ذخیره‌شده نیست
    expect(stored).not.toContain('userFeedback');
    expect(stored).not.toContain('09123456789');
    expect(stored).not.toContain('خیابان نمونه');

    // ۲) داده نسخه قبلی دست‌نخورده باقی مانده است
    expect(localStorage.getItem(legacyKey)).toBe(legacyValue);
  });
});
