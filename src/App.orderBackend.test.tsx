// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { SERVICES_LIST } from './data/mockData';
import { DEMO_STORAGE_KEY } from './services/pii';
import {
  createOrderBackend,
  OrderGatewayError,
  type CustomerOrderGateway,
  type OrderBackend,
  type OrderReceipt,
  type OrderRequest,
  type Quote,
  type SubmitOrderOptions,
} from './services/customerOrders';
import { IDEMPOTENCY_KEY_PATTERN } from './services/customerOrders/idempotency';
import { waitForInvoice } from './testing/invoice';

/**
 * انتخاب اتصال سفارش بدون تغییر فرم‌ها — روی مسیر واقعی `<App />`.
 *
 * ⚠️ adapter این آزمون **ساختگی** است (یک test double در حافظه). این آزمون فقط نشان می‌دهد
 * فرم رزرو بدون هیچ تغییری با هر adapterِ پیرو قرارداد کار می‌کند و فقط فیلدهای مجاز را
 * می‌فرستد. هیچ اتصال واقعی به بک‌اند مستقل سایت یا بک‌اند اپ موبایل سنجیده نمی‌شود؛
 * آن اتصال‌ها هنوز ساخته نشده‌اند.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

/** فیلدهای مجاز `OrderRequest`؛ هر کلید دیگری یعنی فرم چیزی بیش از قرارداد فرستاده است. */
const ALLOWED_REQUEST_KEYS = new Set<keyof OrderRequest>([
  'serviceId',
  'hours',
  'addonIds',
  'hasDetergentPackage',
  'promoCode',
  'cleanerGender',
  'requestedCleanerId',
  'squareMeters',
  'roomsCount',
  'date',
  'timeSlot',
  'cityName',
  'district',
  'address',
  'unit',
  'customerName',
  'customerPhone',
  'notes',
  'acceptedQuote',
]);

const FORBIDDEN_REQUEST_KEYS = [
  'totalPrice',
  'discountApplied',
  'status',
  'paymentStatus',
  'paymentMethod',
  'cleanerId',
  'cleanerName',
  'cleanerPhone',
  'trackingCode',
  'id',
];

interface SubmitCall {
  request: OrderRequest;
  options: SubmitOrderOptions;
}

/** مبلغی که فقط adapter ساختگی می‌سازد؛ موتور نمایشی هرگز به آن نمی‌رسد. */
const TEST_QUOTE_TOTAL = 4_321_000;

/** پیش‌فاکتورساز adapter ساختگی: هر بار مرجع تازه با مهلت یک دقیقه. */
const createTestQuotes = () => {
  const issued: Quote[] = [];
  const getQuote = async (): Promise<Quote> => {
    const quote: Quote = {
      serviceTitle: 'خدمت adapter ساختگی',
      hours: 4,
      hourlyRate: TEST_QUOTE_TOTAL / 4,
      serviceBase: TEST_QUOTE_TOTAL,
      addonLines: [],
      addonsTotal: 0,
      detergentCost: 0,
      subtotal: TEST_QUOTE_TOTAL,
      discountLines: [],
      discountsTotal: 0,
      total: TEST_QUOTE_TOTAL,
      isProvisional: false,
      reference: `TEST-QUOTE-${issued.length + 1}`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    issued.push(quote);
    return quote;
  };
  return { issued, getQuote };
};

/** adapter ساختگی آزمون: درخواست‌ها را ثبت می‌کند و رسیدی با مقدارهای خودش برمی‌گرداند. */
const createTestDoubleBackend = (
  respond: (call: SubmitCall, index: number) => Promise<OrderReceipt>,
): { backend: OrderBackend; calls: SubmitCall[]; quotes: Quote[] } => {
  const calls: SubmitCall[] = [];
  const quotes = createTestQuotes();
  const gateway: CustomerOrderGateway = {
    getQuote: quotes.getQuote,
    submitOrderRequest: async (request, options) => {
      const call = { request: structuredClone(request), options: { ...options } };
      calls.push(call);
      return respond(call, calls.length - 1);
    },
    trackOrder: async () => null,
  };
  // `mode` فقط برچسب است؛ این adapter اتصال واقعی «مستقل» نیست.
  return { backend: { mode: 'standalone', gateway, demoLedger: null }, calls, quotes: quotes.issued };
};

const TEST_RECEIPT: OrderReceipt = {
  trackingCode: 'TEST-DOUBLE-0001',
  status: 'new',
  createdAt: '2026-10-21T10:00:00.000Z',
  total: 4_321_000,
  isProvisional: false,
};

const openBooking = (backend?: OrderBackend): HTMLElement => {
  render(<App orderBackend={backend} />);
  fireEvent.click(screen.getAllByRole('button', { name: /رزرو آنلاین نظافت/ })[0]);
  return screen.getByRole('dialog', { name: 'ثبت درخواست خدمات نظافت' });
};

const nextStep = (dialog: HTMLElement): void => {
  fireEvent.click(within(dialog).getByRole('button', { name: /مرحله بعد/ }));
};

/** مرحلهٔ ۴ بدون صبر برای پیش‌فاکتور (برای حالت‌هایی که پیش‌فاکتور نمی‌رسد). */
const toInvoiceStep = (dialog: HTMLElement): void => {
  nextStep(dialog);
  nextStep(dialog);
  fireEvent.change(within(dialog).getByLabelText(/آدرس دقیق/), { target: { value: 'خیابان نمونه، پلاک ۱' } });
  fireEvent.change(within(dialog).getByLabelText(/نام و نام خانوادگی/), { target: { value: 'کاربر آزمایشی' } });
  fireEvent.change(within(dialog).getByLabelText(/شماره همراه/), { target: { value: '۰۹۱۲۱۲۳۴۵۶۷' } });
  nextStep(dialog);
};

/**
 * همان مسیر کاربر در آزمون‌های دیگر: دو مرحلهٔ اول با پیش‌فرض‌ها، مرحلهٔ ۳ با اطلاعات تماس، و
 * صبر تا نمایش پیش‌فاکتورِ adapter.
 */
const toInvoice = async (dialog: HTMLElement): Promise<HTMLButtonElement> => {
  toInvoiceStep(dialog);
  return waitForInvoice(dialog);
};

describe('همان فرم رزرو با adapterِ دیگر — بدون تغییر فرم (adapter ساختگی، نه اتصال واقعی)', () => {
  it('فقط فیلدهای مجاز قرارداد و یک کلید تکرار معتبر به adapter می‌رسد و رسید همان adapter نمایش داده می‌شود', async () => {
    const { backend, calls, quotes } = createTestDoubleBackend(async () => TEST_RECEIPT);
    const dialog = openBooking(backend);

    const confirm = await toInvoice(dialog);
    // فاکتور همان مبلغ adapter است، نه برآورد مرورگر.
    expect(dialog.textContent).toContain(TEST_QUOTE_TOTAL.toLocaleString('fa-IR'));
    fireEvent.click(confirm);

    expect(await within(dialog).findByText(TEST_RECEIPT.trackingCode)).toBeTruthy();
    expect(calls).toHaveLength(1);

    const [{ request, options }] = calls;
    for (const key of Object.keys(request)) {
      expect(ALLOWED_REQUEST_KEYS.has(key as keyof OrderRequest), `کلید غیرمجاز: ${key}`).toBe(true);
    }
    for (const key of FORBIDDEN_REQUEST_KEYS) expect(request).not.toHaveProperty(key);

    expect(SERVICES_LIST.some((service) => service.id === request.serviceId)).toBe(true);
    expect(Number.isInteger(request.hours)).toBe(true);
    expect(request.customerPhone).toBe('09121234567');
    expect(request.customerName).toBe('کاربر آزمایشی');
    expect(options.idempotencyKey).toMatch(IDEMPOTENCY_KEY_PATTERN);
    // ثبت به همان پیش‌فاکتوری گره خورده که مشتری دیده است.
    expect(quotes).toHaveLength(1);
    expect(request.acceptedQuote).toEqual({ reference: quotes[0].reference, total: TEST_QUOTE_TOTAL });

    // هیچ نسخهٔ نمایشی‌ای در کار نیست: چیزی در حافظهٔ مرورگر نوشته نشده است.
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });

  it('پس از شکست قطعی «ارسال نشد»، تلاش دوباره برای همان درخواست همان کلید تکرار را می‌فرستد', async () => {
    const { backend, calls } = createTestDoubleBackend(async (_call, index) => {
      if (index === 0) throw new OrderGatewayError('unavailable', 'مرورگر آفلاین بود؛ چیزی ارسال نشد.');
      return TEST_RECEIPT;
    });
    const dialog = openBooking(backend);
    const confirm = await toInvoice(dialog);

    fireEvent.click(confirm);
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('ارتباط با سرور برقرار نشد و درخواست ارسال نشد');
    expect(within(dialog).queryByText(TEST_RECEIPT.trackingCode)).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }));
    expect(await within(dialog).findByText(TEST_RECEIPT.trackingCode)).toBeTruthy();

    expect(calls).toHaveLength(2);
    expect(calls[1].options.idempotencyKey).toBe(calls[0].options.idempotencyKey);
    expect(calls[1].request).toEqual(calls[0].request);
  });

  it('پس از شکست قطعی، اگر کاربر درخواست را تغییر دهد، کلید تکرار تازه ساخته می‌شود', async () => {
    const { backend, calls } = createTestDoubleBackend(async (_call, index) => {
      if (index === 0) throw new OrderGatewayError('rate_limited', 'تعداد درخواست زیاد است؛ چیزی ثبت نشد.');
      return TEST_RECEIPT;
    });
    const dialog = openBooking(backend);

    fireEvent.click(await toInvoice(dialog));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('تعداد درخواست‌ها زیاد بود');

    // بازگشت به مرحلهٔ ۳ و تغییر توضیحات، سپس ثبت دوباره.
    fireEvent.click(within(dialog).getByRole('button', { name: /مرحله قبل/ }));
    fireEvent.change(within(dialog).getByLabelText(/توضیحات/), { target: { value: 'زنگ دوم' } });
    nextStep(dialog);
    fireEvent.click(await waitForInvoice(dialog));
    expect(await within(dialog).findByText(TEST_RECEIPT.trackingCode)).toBeTruthy();

    expect(calls).toHaveLength(2);
    expect(calls[1].request.notes).toBe('زنگ دوم');
    expect(calls[1].options.idempotencyKey).not.toBe(calls[0].options.idempotencyKey);
  });
});

/**
 * adapter ساختگی «ذخیرهٔ موفق، پاسخ گم‌شده»: مثل یک بک‌اند واقعی، سفارش را با کلید تکرار نگه
 * می‌دارد و برای همان کلید همان سفارش را برمی‌گرداند؛ ولی در اولین تلاش، پس از ذخیره، پاسخ را
 * «گم» می‌کند. این adapter در حافظه است و اتصال واقعی نیست.
 */
const createLostResponseBackend = (lose: (index: number) => OrderGatewayError | Error | null) => {
  const ordersByKey = new Map<string, { request: OrderRequest; receipt: OrderReceipt }>();
  const calls: SubmitCall[] = [];
  const gateway: CustomerOrderGateway = {
    getQuote: createTestQuotes().getQuote,
    submitOrderRequest: async (request, options) => {
      calls.push({ request: structuredClone(request), options: { ...options } });
      const index = calls.length - 1;
      const existing = ordersByKey.get(options.idempotencyKey);
      let receipt: OrderReceipt;
      if (existing) {
        if (JSON.stringify(existing.request) !== JSON.stringify(request)) {
          throw new OrderGatewayError('conflict', 'همان کلید با محتوای دیگر.');
        }
        receipt = existing.receipt;
      } else {
        receipt = { ...TEST_RECEIPT, trackingCode: `LOST-${ordersByKey.size + 1}` };
        ordersByKey.set(options.idempotencyKey, { request: structuredClone(request), receipt });
      }
      const lost = lose(index);
      if (lost) throw lost;
      return receipt;
    },
    trackOrder: async () => null,
  };
  const backend: OrderBackend = { mode: 'standalone', gateway, demoLedger: null };
  return { backend, calls, ordersByKey };
};

describe('نتیجهٔ نامشخص: «ذخیرهٔ موفق، پاسخ گم‌شده» (adapter ساختگی، نه اتصال واقعی)', () => {
  const closeDialog = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'بستن' }));
  const reopen = (): HTMLElement => {
    fireEvent.click(screen.getAllByRole('button', { name: /رزرو آنلاین نظافت/ })[0]);
    return screen.getByRole('dialog', { name: 'ثبت درخواست خدمات نظافت' });
  };

  it('«ثبت نشد» گفته نمی‌شود، فرم قفل می‌ماند، بستن و بازکردن آن را باز نمی‌کند و بررسی دوباره همان سفارش را برمی‌گرداند', async () => {
    const { backend, calls, ordersByKey } = createLostResponseBackend((index) =>
      index === 0 ? new OrderGatewayError('outcome_unknown', 'پاسخ پس از ارسال گم شد.') : null,
    );
    const dialog = openBooking(backend);

    fireEvent.click(await toInvoice(dialog));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('نتیجهٔ ثبت معلوم نیست');
    expect(alert.textContent).not.toMatch(/ثبت نشد|ارسال نشد/);
    expect(within(dialog).getByText('نتیجهٔ ثبت درخواست قبلی معلوم نیست')).toBeTruthy();
    // مراحل فرم در دسترس نیستند؛ درخواست تازه‌ای نمی‌شود ساخت.
    expect(within(dialog).queryByRole('button', { name: /تایید نهایی و ثبت سفارش/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /مرحله قبل/ })).toBeNull();
    expect(within(dialog).queryByLabelText(/توضیحات/)).toBeNull();

    // بستن و بازکردن پنجره تلاش نامشخص را از بین نمی‌برد.
    closeDialog(dialog);
    const reopened = reopen();
    expect(within(reopened).getByText('نتیجهٔ ثبت درخواست قبلی معلوم نیست')).toBeTruthy();
    expect(within(reopened).queryByRole('button', { name: /مرحله بعد/ })).toBeNull();

    fireEvent.click(within(reopened).getByRole('button', { name: /بررسی دوبارهٔ همان درخواست/ }));
    expect(await within(reopened).findByText('LOST-1')).toBeTruthy();

    expect(calls).toHaveLength(2);
    expect(calls[1].options.idempotencyKey).toBe(calls[0].options.idempotencyKey);
    expect(calls[1].request).toEqual(calls[0].request);
    expect(ordersByKey.size).toBe(1);

    // پس از روشن شدن نتیجه، پنجرهٔ تازه دوباره فرم عادی است.
    closeDialog(reopened);
    const fresh = reopen();
    expect(within(fresh).queryByText('نتیجهٔ ثبت درخواست قبلی معلوم نیست')).toBeNull();
    expect(within(fresh).getByRole('button', { name: /مرحله بعد/ })).toBeTruthy();
  });

  it('برای حفظ این وضعیت هیچ اطلاعات شخصی خامی در localStorage نوشته نمی‌شود', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { backend } = createLostResponseBackend(() => new OrderGatewayError('outcome_unknown', 'گم شد.'));
    const dialog = openBooking(backend);

    fireEvent.click(await toInvoice(dialog));
    await within(dialog).findByText('نتیجهٔ ثبت درخواست قبلی معلوم نیست');

    const written = setItem.mock.calls.map(([key, value]) => `${key}=${value}`).join('\n');
    expect(written).not.toMatch(/09121234567|۰۹۱۲۱۲۳۴۵۶۷|کاربر آزمایشی|خیابان نمونه/);
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) ?? '';
      expect(`${key}=${localStorage.getItem(key)}`).not.toMatch(/09121234567|کاربر آزمایشی|خیابان نمونه/);
    }
  });

  it('خطای پیش‌بینی‌نشدهٔ adapter هم نامشخص حساب می‌شود، نه «ثبت نشد»', async () => {
    const { backend } = createLostResponseBackend((index) => (index === 0 ? new Error('خطای ناشناخته') : null));
    const dialog = openBooking(backend);

    fireEvent.click(await toInvoice(dialog));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('نتیجهٔ ثبت معلوم نیست');
    expect(within(dialog).getByText('نتیجهٔ ثبت درخواست قبلی معلوم نیست')).toBeTruthy();
  });

  it('اگر بررسی دوباره شکست قطعی بدهد، قفل برداشته می‌شود و درخواست تغییرکرده کلید تازه می‌گیرد', async () => {
    const { backend, calls } = createLostResponseBackend((index) => {
      if (index === 0) return new OrderGatewayError('outcome_unknown', 'گم شد.');
      if (index === 1) return new OrderGatewayError('validation', 'بک‌اند درخواست را رد کرد.');
      return null;
    });
    const dialog = openBooking(backend);

    fireEvent.click(await toInvoice(dialog));
    await within(dialog).findByText('نتیجهٔ ثبت درخواست قبلی معلوم نیست');

    fireEvent.click(within(dialog).getByRole('button', { name: /بررسی دوبارهٔ همان درخواست/ }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('برخی اطلاعات درخواست معتبر نیست');
    expect(within(dialog).queryByText('نتیجهٔ ثبت درخواست قبلی معلوم نیست')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: /مرحله قبل/ }));
    fireEvent.change(within(dialog).getByLabelText(/توضیحات/), { target: { value: 'زنگ دوم' } });
    nextStep(dialog);
    fireEvent.click(await waitForInvoice(dialog));
    expect(await within(dialog).findByText(/^LOST-/)).toBeTruthy();

    expect(calls).toHaveLength(3);
    expect(calls[1].options.idempotencyKey).toBe(calls[0].options.idempotencyKey);
    expect(calls[2].options.idempotencyKey).not.toBe(calls[0].options.idempotencyKey);
    expect(calls[2].request.notes).toBe('زنگ دوم');
  });
});

describe('نسخهٔ نمایشی: شکست قطعی ذخیره و تلاش دوباره', () => {
  it('پس از خطای ذخیرهٔ مرورگر، تلاش دوباره همان درخواست را ثبت می‌کند و فقط یک سفارش می‌ماند', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const dialog = openBooking();

    fireEvent.click(await toInvoice(dialog));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('ذخیره‌سازی محلی مرورگر ناموفق بود');
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }));
    expect(await within(dialog).findByRole('button', { name: 'کپی کد پیگیری' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) ?? '[]')).toHaveLength(1);
  });
});

describe('حالت‌های پیاده‌سازی‌نشده — خطای روشن، بدون موفقیت کاذب و بدون بازگشت به نسخهٔ نمایشی', () => {
  it.each([
    ['standalone', 'اتصال به بک‌اند مستقل سایت هنوز ساخته نشده است.'],
    ['coordinated', 'اتصال به بک‌اند مشترک با اپ موبایل هنوز ساخته نشده است.'],
    [null, 'تنظیمات اتصال سفارش‌ها نامعتبر است.'],
  ] as const)('حالت %s', async (mode, expectedText) => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const dialog = openBooking(createOrderBackend(mode));

    toInvoiceStep(dialog);

    // پیش‌فاکتور هم از همان adapter است؛ پس بدون اتصال، مبلغی نمایش داده نمی‌شود و تأیید ممکن نیست.
    const notice = await within(dialog).findByText(new RegExp(expectedText.replace(/[.]/g, '\\.')));
    expect(notice.textContent).toContain('درخواستی ثبت نشد');
    expect(notice.textContent).toContain('پیش‌فاکتور دریافت نشد');
    const confirm = within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'کپی کد پیگیری' })).toBeNull());
    expect(within(dialog).queryByRole('button', { name: 'کپی کد پیگیری' })).toBeNull();
    expect(setItem.mock.calls.filter(([key]) => key === DEMO_STORAGE_KEY)).toHaveLength(0);
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });
});
