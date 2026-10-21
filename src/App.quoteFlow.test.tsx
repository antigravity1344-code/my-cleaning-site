// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { DEMO_STORAGE_KEY } from './services/pii';
import {
  OrderGatewayError,
  type CustomerOrderGateway,
  type OrderBackend,
  type OrderReceipt,
  type OrderRequest,
  type Quote,
  type QuoteRequest,
} from './services/customerOrders';
import { waitForInvoice } from './testing/invoice';

/**
 * فاکتور فرم از پیش‌فاکتور gateway و ثبت گره‌خورده به پیش‌فاکتور تأییدشده — روی مسیر واقعی
 * `<App />`.
 *
 * ⚠️ adapter این آزمون‌ها **ساختگی** (در حافظه) است و اتصال واقعی به بک‌اند سایت یا اپ موبایل
 * نیست. هدف فقط این است که نشان دهد فرم بدون دانستن adapter:
 *   • مبلغ را از پیش‌فاکتور همان adapter نشان می‌دهد، نه از محاسبهٔ مرورگر؛
 *   • کد تخفیف را با همان adapter می‌سنجد؛
 *   • ثبت را با مرجع و مبلغ همان پیش‌فاکتورِ دیده‌شده می‌فرستد؛
 *   • در انقضا یا تغییر قیمت، پیش‌فاکتور تازه می‌گیرد و ثبت خودکار انجام نمی‌دهد.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

const RECEIPT: OrderReceipt = {
  trackingCode: 'QUOTE-DOUBLE-0001',
  status: 'new',
  createdAt: '2026-10-21T10:00:00.000Z',
  total: 0,
  isProvisional: false,
};

/** کد تخفیفی که فقط adapter ساختگی می‌شناسد (در فهرست نمونهٔ سایت نیست). */
const DOUBLE_PROMO = 'ONLYDOUBLE';
const DOUBLE_PROMO_AMOUNT = 321_000;

interface DoubleOptions {
  /** مبلغ پایهٔ هر پیش‌فاکتور، به ترتیب صدور (آخرین مقدار تکرار می‌شود). */
  totals?: number[];
  /** مهلت هر پیش‌فاکتور به میلی‌ثانیه، به ترتیب صدور (آخرین مقدار تکرار می‌شود). */
  ttls?: number[];
  /** پاسخ ثبت؛ پیش‌فرض: رسید موفق. */
  submit?: (request: OrderRequest, index: number) => Promise<OrderReceipt>;
  /** پاسخ پیش‌فاکتور؛ برای شبیه‌سازی خطا. */
  quoteFailure?: (index: number) => OrderGatewayError | null;
}

const pick = <T,>(values: T[], index: number): T => values[Math.min(index, values.length - 1)];

const createQuoteDouble = ({ totals = [4_000_000], ttls = [60_000], submit, quoteFailure }: DoubleOptions = {}) => {
  const quotes: Array<{ request: QuoteRequest; quote: Quote }> = [];
  const submitted: OrderRequest[] = [];
  let quoteCalls = 0;
  const gateway: CustomerOrderGateway = {
    getQuote: async (request) => {
      const index = quoteCalls;
      quoteCalls += 1;
      const failure = quoteFailure?.(index);
      if (failure) throw failure;
      if (request.promoCode && request.promoCode !== DOUBLE_PROMO) {
        throw new OrderGatewayError('validation', 'کد تخفیف معتبر نیست.', 'promoCode');
      }
      const base = pick(totals, quotes.length);
      const discount = request.promoCode === DOUBLE_PROMO ? DOUBLE_PROMO_AMOUNT : 0;
      const quote: Quote = {
        serviceTitle: 'خدمت adapter ساختگی',
        hours: request.hours,
        hourlyRate: Math.round(base / request.hours),
        serviceBase: base,
        addonLines: [],
        addonsTotal: 0,
        detergentCost: 0,
        subtotal: base,
        discountLines: discount ? [{ id: `promo:${DOUBLE_PROMO}`, title: `کد تخفیف ${DOUBLE_PROMO}`, amount: discount }] : [],
        discountsTotal: discount,
        total: base - discount,
        isProvisional: false,
        reference: `DOUBLE-Q-${quotes.length + 1}`,
        expiresAt: new Date(Date.now() + pick(ttls, quotes.length)).toISOString(),
      };
      quotes.push({ request: structuredClone(request), quote });
      return quote;
    },
    submitOrderRequest: async (request) => {
      submitted.push(structuredClone(request));
      if (submit) return submit(request, submitted.length - 1);
      return { ...RECEIPT, total: request.acceptedQuote.total };
    },
    trackOrder: async () => null,
  };
  const backend: OrderBackend = { mode: 'standalone', gateway, demoLedger: null };
  return { backend, quotes, submitted, quoteCalls: () => quoteCalls };
};

const fa = (value: number): string => value.toLocaleString('fa-IR');

const openToInvoice = (backend: OrderBackend): HTMLElement => {
  render(<App orderBackend={backend} />);
  fireEvent.click(screen.getAllByRole('button', { name: /رزرو آنلاین نظافت/ })[0]);
  const dialog = screen.getByRole('dialog', { name: 'ثبت درخواست خدمات نظافت' });
  const next = () => fireEvent.click(within(dialog).getByRole('button', { name: /مرحله بعد/ }));
  next();
  next();
  fireEvent.change(within(dialog).getByLabelText(/آدرس دقیق/), { target: { value: 'خیابان نمونه، پلاک ۱' } });
  fireEvent.change(within(dialog).getByLabelText(/نام و نام خانوادگی/), { target: { value: 'کاربر آزمایشی' } });
  fireEvent.change(within(dialog).getByLabelText(/شماره همراه/), { target: { value: '09121234567' } });
  next();
  return dialog;
};

const invoiceTotal = (dialog: HTMLElement): string => dialog.querySelector('.text-2xl')?.textContent?.trim() ?? '';

describe('فاکتور از پیش‌فاکتور gateway (adapter ساختگی، نه اتصال واقعی)', () => {
  it('تا رسیدن پیش‌فاکتور تأیید ممکن نیست؛ بعد مبلغ همان adapter نمایش داده و با ثبت فرستاده می‌شود', async () => {
    const double = createQuoteDouble({ totals: [4_000_000] });
    const dialog = openToInvoice(double.backend);

    const confirm = within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    await waitForInvoice(dialog);
    expect(invoiceTotal(dialog)).toBe(fa(4_000_000));
    expect(dialog.textContent).toContain('خدمت adapter ساختگی');

    fireEvent.click(confirm);
    expect(await within(dialog).findByText(RECEIPT.trackingCode)).toBeTruthy();
    expect(double.submitted).toHaveLength(1);
    expect(double.submitted[0].acceptedQuote).toEqual({ reference: 'DOUBLE-Q-1', total: 4_000_000 });
    // ورودی پیش‌فاکتور همان انتخاب‌های ثبت است.
    expect(double.quotes[0].request.hours).toBe(double.submitted[0].hours);
    expect(double.quotes[0].request.serviceId).toBe(double.submitted[0].serviceId);
  });

  it('کد تخفیف را همان adapter می‌سنجد: کد نمونهٔ سایت رد و کد adapter پذیرفته می‌شود', async () => {
    const double = createQuoteDouble({ totals: [4_000_000] });
    const dialog = openToInvoice(double.backend);
    await waitForInvoice(dialog);
    const promo = within(dialog).getByLabelText(/کد تخفیف دارید/);
    const status = within(dialog).getByRole('status');

    // کدی که در فهرست نمونهٔ سایت هست ولی adapter نمی‌شناسد.
    fireEvent.change(promo, { target: { value: 'PAK1403' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'اعمال' }));
    await waitFor(() => expect(status.textContent).toBe('کد تخفیف معتبر نیست.'));
    expect(invoiceTotal(dialog)).toBe(fa(4_000_000));

    fireEvent.change(promo, { target: { value: DOUBLE_PROMO.toLowerCase() } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'اعمال' }));
    await waitFor(() => expect(status.textContent).toContain(fa(DOUBLE_PROMO_AMOUNT)));
    await waitFor(() => expect(invoiceTotal(dialog)).toBe(fa(4_000_000 - DOUBLE_PROMO_AMOUNT)));

    fireEvent.click(await waitForInvoice(dialog));
    await within(dialog).findByText(RECEIPT.trackingCode);
    const [request] = double.submitted;
    expect(request.promoCode).toBe(DOUBLE_PROMO);
    const accepted = double.quotes.find((item) => item.quote.reference === request.acceptedQuote.reference);
    expect(accepted?.request.promoCode).toBe(DOUBLE_PROMO);
    expect(request.acceptedQuote.total).toBe(4_000_000 - DOUBLE_PROMO_AMOUNT);
  });

  it('پیش‌فاکتورِ منقضی ثبت نمی‌شود؛ پیش‌فاکتور تازه گرفته می‌شود و تأیید دوباره لازم است', async () => {
    const double = createQuoteDouble({ totals: [4_000_000, 4_200_000], ttls: [40, 60_000] });
    const dialog = openToInvoice(double.backend);
    const confirm = await waitForInvoice(dialog);
    expect(invoiceTotal(dialog)).toBe(fa(4_000_000));

    await new Promise((resolve) => setTimeout(resolve, 60));
    fireEvent.click(confirm);

    expect((await within(dialog).findByRole('alert')).textContent).toContain('اعتبار پیش‌فاکتور تمام شد');
    expect(double.submitted).toHaveLength(0);
    await waitFor(() => expect(invoiceTotal(dialog)).toBe(fa(4_200_000)));
    expect(double.quotes).toHaveLength(2);

    fireEvent.click(await waitForInvoice(dialog));
    await within(dialog).findByText(RECEIPT.trackingCode);
    expect(double.submitted).toHaveLength(1);
    expect(double.submitted[0].acceptedQuote).toEqual({ reference: 'DOUBLE-Q-2', total: 4_200_000 });
  });

  it('اگر بک‌اند هنگام ثبت بگوید قیمت عوض شده، سفارشی ساخته نمی‌شود و مبلغ تازه برای تأیید دوباره نمایش داده می‌شود', async () => {
    const double = createQuoteDouble({
      totals: [4_000_000, 4_500_000],
      submit: async (request, index) => {
        if (index === 0) throw new OrderGatewayError('price_changed', 'قیمت تغییر کرده است.');
        return { ...RECEIPT, total: request.acceptedQuote.total };
      },
    });
    const dialog = openToInvoice(double.backend);
    fireEvent.click(await waitForInvoice(dialog));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('مبلغ تغییر کرده است');
    expect(within(dialog).queryByText(RECEIPT.trackingCode)).toBeNull();
    await waitFor(() => expect(invoiceTotal(dialog)).toBe(fa(4_500_000)));

    // ثبت خودکار انجام نشده است: فقط پس از تأیید دوبارهٔ مشتری.
    expect(double.submitted).toHaveLength(1);
    fireEvent.click(await waitForInvoice(dialog));
    await within(dialog).findByText(RECEIPT.trackingCode);
    expect(double.submitted).toHaveLength(2);
    expect(double.submitted[1].acceptedQuote).toEqual({ reference: 'DOUBLE-Q-2', total: 4_500_000 });
  });

  it('اگر پیش‌فاکتور نرسد، مبلغی نمایش داده نمی‌شود، تأیید غیرفعال است و دریافت دوباره ممکن است', async () => {
    const double = createQuoteDouble({
      totals: [4_000_000],
      quoteFailure: (index) => (index === 0 ? new OrderGatewayError('unavailable', 'سرور در دسترس نیست.') : null),
    });
    const dialog = openToInvoice(double.backend);

    expect(await within(dialog).findByText(/پیش‌فاکتور دریافت نشد/)).toBeTruthy();
    expect(invoiceTotal(dialog)).toBe('');
    const confirm = within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.click(within(dialog).getByRole('button', { name: 'دریافت دوبارهٔ پیش‌فاکتور' }));
    await waitForInvoice(dialog);
    expect(invoiceTotal(dialog)).toBe(fa(4_000_000));
    expect(double.submitted).toHaveLength(0);
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });
});

describe('نسخهٔ نمایشی: همان مبالغ، این بار از پیش‌فاکتور adapter نمایشی', () => {
  it('ثبت نمایشی با پیش‌فاکتور همان adapter انجام می‌شود و مبلغ ذخیره‌شده همان مبلغ فاکتور است', async () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /رزرو آنلاین نظافت/ })[0]);
    const dialog = screen.getByRole('dialog', { name: 'ثبت درخواست خدمات نظافت' });
    const next = () => fireEvent.click(within(dialog).getByRole('button', { name: /مرحله بعد/ }));
    next();
    next();
    fireEvent.change(within(dialog).getByLabelText(/آدرس دقیق/), { target: { value: 'خیابان نمونه، پلاک ۱' } });
    fireEvent.change(within(dialog).getByLabelText(/نام و نام خانوادگی/), { target: { value: 'کاربر آزمایشی' } });
    fireEvent.change(within(dialog).getByLabelText(/شماره همراه/), { target: { value: '09121234567' } });
    next();

    const confirm = await waitForInvoice(dialog);
    const shown = invoiceTotal(dialog);
    fireEvent.click(confirm);
    await within(dialog).findByRole('button', { name: 'کپی کد پیگیری' });

    const [stored] = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) ?? '[]') as Array<{ totalPrice: number }>;
    expect(fa(stored.totalPrice)).toBe(shown);
  });
});
