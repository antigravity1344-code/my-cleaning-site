// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { CostCalculator } from './CostCalculator';
import { BookingModal } from './BookingModal';
import type { ServiceType, CleanerGender } from '../types';
import { calculatePrice } from '../pricing/pricingEngine';

/**
 * آزمون یکپارچگی DOM برای سناریوی پذیرش مأموریت:
 * «مبلغ نمایش‌داده‌شده در محاسبه‌گر آنلاین» باید دقیقاً برابر
 * «مبلغ فاکتور نهایی در فرم رزرو» برای همان اطلاعات باشد.
 *
 * ⚠️ محدوده دقیق این فایل (یافته ۴ مأموریت ۰۰۳):
 * این فایل دو کامپوننت را **جداگانه** رندر می‌کند و ورودی‌ها را دستی به
 * `BookingModal` می‌دهد. بنابراین:
 *   • مسیر واقعی `App.tsx` (هندلر `handleProceedFromCalculator` و باز شدن
 *     مودال توسط App) را اجرا نمی‌کند؛
 *   • صرفاً ثابت می‌کند برای ورودی‌های آزمون‌شده، دو کامپوننت با یک موتور
 *     قیمت‌گذاری به یک عدد می‌رسند؛
 *   • «عدم امکان ساختاری واگرایی» را اثبات نمی‌کند. چنین ادعایی در گزارش‌ها
 *     مجاز نیست.
 * پوشش مسیر واقعی App در `src/App.bookingFlow.test.tsx` است.
 */

// بدون این پاک‌سازی، رندرهای آزمون‌های قبلی در DOM می‌مانند و پرس‌وجوها چندگانه می‌شوند.
afterEach(cleanup);

type CalculatorTransfer = {
  serviceId: ServiceType;
  hours: number;
  squareMeters: number;
  roomsCount: number;
  selectedAddons: string[];
  hasDetergentPackage: boolean;
  cleanerGender: CleanerGender;
};

const toPersianDigits = (value: number): string => value.toLocaleString('fa-IR');

/** مبلغ نمایش‌داده‌شده در کارت برآورد محاسبه‌گر را از DOM می‌خواند. */
const readCalculatorTotal = (container: HTMLElement): string => {
  const node = container.querySelector('.text-3xl');
  if (!node?.textContent) throw new Error('مبلغ محاسبه‌گر در DOM پیدا نشد.');
  return node.textContent.trim();
};

/** مبلغ نمایش‌داده‌شده در فاکتور رزرو (مرحله ۴) را از DOM می‌خواند. */
const readInvoiceTotal = (container: HTMLElement): string => {
  const node = container.querySelector('.text-2xl');
  if (!node?.textContent) throw new Error('مبلغ فاکتور در DOM پیدا نشد.');
  return node.textContent.trim();
};

/** کاربر را تا مرحله فاکتور پیش می‌برد (تکمیل اطلاعات تماس الزامی). */
const goToInvoiceStep = (): void => {
  for (let step = 0; step < 3; step += 1) {
    fireEvent.click(screen.getByRole('button', { name: /مرحله بعد/ }));
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
  fireEvent.click(screen.getByRole('button', { name: /مرحله بعد/ }));
};

describe('محاسبه‌گر → فرم رزرو: یکسان‌بودن مبلغ', () => {
  it('مبلغ نمایش‌داده‌شده در محاسبه‌گر با مبلغ فاکتور رزرو برابر است (حالت پیش‌فرض)', () => {
    const onProceed = vi.fn();
    const calculator = render(<CostCalculator onProceedToBooking={onProceed} />);

    const calculatorTotal = readCalculatorTotal(calculator.container);

    fireEvent.click(screen.getByRole('button', { name: /ادامه در فرم آزمایشی رزرو/ }));
    expect(onProceed).toHaveBeenCalledTimes(1);

    // همان مسیر App.tsx: فقط ورودی‌های خام منتقل می‌شوند و هیچ مبلغی منتقل نمی‌شود.
    const transferred = onProceed.mock.calls[0][0] as CalculatorTransfer;
    expect(transferred).not.toHaveProperty('totalPrice');

    const booking = render(
      <BookingModal
        isOpen
        onClose={() => undefined}
        initialParams={transferred}
        onOrderCreated={() => undefined}
        createOrderService={async () => {
          throw new Error('در این آزمون ثبت سفارش انجام نمی‌شود.');
        }}
      />,
    );

    goToInvoiceStep();
    const invoiceTotal = readInvoiceTotal(booking.container);

    expect(invoiceTotal).toBe(calculatorTotal);
  });

  it('برای ورودی‌های متفاوت (متراژ، اتاق، افزودنی‌ها) نیز دو مبلغ یکسان می‌مانند', () => {
    const onProceed = vi.fn();
    const { container } = render(<CostCalculator onProceedToBooking={onProceed} />);

    // تغییر متراژ (ساعت پیشنهادی را تغییر می‌دهد) و افزودن دو خدمت جانبی
    const sliders = container.querySelectorAll('input[type="range"]');
    fireEvent.change(sliders[0], { target: { value: '220' } });
    fireEvent.click(screen.getAllByText('شستشوی کامل شیشه‌ها و بالکن')[0]);
    fireEvent.click(screen.getAllByText('دیوارشویی تخصصی اتاق‌ها')[0]);

    const calculatorTotal = readCalculatorTotal(container);

    fireEvent.click(screen.getByRole('button', { name: /ادامه در فرم آزمایشی رزرو/ }));
    const transferred = onProceed.mock.calls[0][0] as CalculatorTransfer;

    // انتقال می‌بایست افزودنی‌ها و ساعت بازمحاسبه‌شده را حمل کند
    expect(transferred.selectedAddons).toEqual(expect.arrayContaining(['windows', 'walls']));

    const booking = render(
      <BookingModal
        isOpen
        onClose={() => undefined}
        initialParams={transferred}
        onOrderCreated={() => undefined}
        createOrderService={async () => {
          throw new Error('در این آزمون ثبت سفارش انجام نمی‌شود.');
        }}
      />,
    );

    goToInvoiceStep();
    expect(readInvoiceTotal(booking.container)).toBe(calculatorTotal);

    // و مبلغ با موتور قیمت‌گذاری مشترک هم مطابقت دارد
    const engineTotal = calculatePrice({
      serviceId: transferred.serviceId,
      hours: transferred.hours,
      addonIds: transferred.selectedAddons,
      hasDetergentPackage: transferred.hasDetergentPackage,
    }).total;
    expect(toPersianDigits(engineTotal)).toBe(calculatorTotal);
  });
});

describe('صفحه فاکتور و موفقیت: بدون ادعای عملیاتی/مالی نادرست', () => {
  const baseParams: CalculatorTransfer = {
    serviceId: 'home-standard',
    hours: 4,
    squareMeters: 90,
    roomsCount: 2,
    selectedAddons: [],
    hasDetergentPackage: true,
    cleanerGender: 'no-pref',
  };

  it('مبلغ در فاکتور به‌عنوان «پیشنهادی (آزمایشی)» برچسب خورده است', () => {
    const { container } = render(
      <BookingModal isOpen onClose={() => undefined} initialParams={baseParams} onOrderCreated={() => undefined} />,
    );
    goToInvoiceStep();

    expect(container.textContent).toContain('مبلغ پیشنهادی (آزمایشی)');
    expect(container.textContent).not.toContain('مبلغ کل نهایی');
  });

  it('گزینه پرداخت اینترنتی غیرفعال و شفاف‌سازی شده است (بدون وعده درگاه شاپرک)', () => {
    const { container } = render(
      <BookingModal isOpen onClose={() => undefined} initialParams={baseParams} onOrderCreated={() => undefined} />,
    );
    goToInvoiceStep();

    expect(container.textContent).not.toContain('شاپرک');
    expect(container.textContent).not.toContain('پرداخت اینترنتی امن');
    expect(container.textContent).toContain('پرداخت اینترنتی');
    expect(container.textContent).toContain('در نسخه آزمایشی غیرفعال است');
  });

  it('هیچ تعهد گارانتی یا بیمه‌ای در فاکتور نمایش داده نمی‌شود', () => {
    const { container } = render(
      <BookingModal isOpen onClose={() => undefined} initialParams={baseParams} onOrderCreated={() => undefined} />,
    );
    goToInvoiceStep();

    expect(container.textContent).not.toContain('گارانتی رضایت ۱۰۰٪');
    expect(container.textContent).not.toContain('تضمین');
  });
});
