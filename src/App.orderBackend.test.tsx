// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  type SubmitOrderOptions,
} from './services/customerOrders';
import { IDEMPOTENCY_KEY_PATTERN } from './services/customerOrders/idempotency';

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

/** adapter ساختگی آزمون: درخواست‌ها را ثبت می‌کند و رسیدی با مقدارهای خودش برمی‌گرداند. */
const createTestDoubleBackend = (
  respond: (call: SubmitCall, index: number) => Promise<OrderReceipt>,
): { backend: OrderBackend; calls: SubmitCall[] } => {
  const calls: SubmitCall[] = [];
  const gateway: CustomerOrderGateway = {
    getQuote: async () => {
      throw new OrderGatewayError('not_implemented', 'در این آزمون پیش‌فاکتور لازم نیست.');
    },
    submitOrderRequest: async (request, options) => {
      const call = { request: structuredClone(request), options: { ...options } };
      calls.push(call);
      return respond(call, calls.length - 1);
    },
    trackOrder: async () => null,
  };
  // `mode` فقط برچسب است؛ این adapter اتصال واقعی «مستقل» نیست.
  return { backend: { mode: 'standalone', gateway, demoLedger: null }, calls };
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

/** همان مسیر کاربر در آزمون‌های دیگر: دو مرحلهٔ اول با پیش‌فرض‌ها، مرحلهٔ ۳ با اطلاعات تماس. */
const toInvoice = (dialog: HTMLElement): HTMLElement => {
  nextStep(dialog);
  nextStep(dialog);
  fireEvent.change(within(dialog).getByLabelText(/آدرس دقیق/), { target: { value: 'خیابان نمونه، پلاک ۱' } });
  fireEvent.change(within(dialog).getByLabelText(/نام و نام خانوادگی/), { target: { value: 'کاربر آزمایشی' } });
  fireEvent.change(within(dialog).getByLabelText(/شماره همراه/), { target: { value: '۰۹۱۲۱۲۳۴۵۶۷' } });
  nextStep(dialog);
  return within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ });
};

describe('همان فرم رزرو با adapterِ دیگر — بدون تغییر فرم (adapter ساختگی، نه اتصال واقعی)', () => {
  it('فقط فیلدهای مجاز قرارداد و یک کلید تکرار معتبر به adapter می‌رسد و رسید همان adapter نمایش داده می‌شود', async () => {
    const { backend, calls } = createTestDoubleBackend(async () => TEST_RECEIPT);
    const dialog = openBooking(backend);

    fireEvent.click(toInvoice(dialog));

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

    // هیچ نسخهٔ نمایشی‌ای در کار نیست: چیزی در حافظهٔ مرورگر نوشته نشده است.
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });

  it('پس از قطع ارتباط، تلاش دوباره برای همان درخواست همان کلید تکرار را می‌فرستد', async () => {
    const { backend, calls } = createTestDoubleBackend(async (_call, index) => {
      if (index === 0) throw new OrderGatewayError('unavailable', 'شبکه قطع است.');
      return TEST_RECEIPT;
    });
    const dialog = openBooking(backend);
    const confirm = toInvoice(dialog);

    fireEvent.click(confirm);
    expect((await within(dialog).findByRole('alert')).textContent).toContain('ارتباط با سرور برقرار نشد');
    expect(within(dialog).queryByText(TEST_RECEIPT.trackingCode)).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }));
    expect(await within(dialog).findByText(TEST_RECEIPT.trackingCode)).toBeTruthy();

    expect(calls).toHaveLength(2);
    expect(calls[1].options.idempotencyKey).toBe(calls[0].options.idempotencyKey);
    expect(calls[1].request).toEqual(calls[0].request);
  });

  it('اگر کاربر پس از خطا درخواست را تغییر دهد، کلید تکرار تازه ساخته می‌شود', async () => {
    const { backend, calls } = createTestDoubleBackend(async (_call, index) => {
      if (index === 0) throw new OrderGatewayError('unavailable', 'شبکه قطع است.');
      return TEST_RECEIPT;
    });
    const dialog = openBooking(backend);

    fireEvent.click(toInvoice(dialog));
    await within(dialog).findByRole('alert');

    // بازگشت به مرحلهٔ ۳ و تغییر توضیحات، سپس ثبت دوباره.
    fireEvent.click(within(dialog).getByRole('button', { name: /مرحله قبل/ }));
    fireEvent.change(within(dialog).getByLabelText(/توضیحات/), { target: { value: 'زنگ دوم' } });
    nextStep(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }));
    expect(await within(dialog).findByText(TEST_RECEIPT.trackingCode)).toBeTruthy();

    expect(calls).toHaveLength(2);
    expect(calls[1].request.notes).toBe('زنگ دوم');
    expect(calls[1].options.idempotencyKey).not.toBe(calls[0].options.idempotencyKey);
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

    fireEvent.click(toInvoice(dialog));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain(expectedText);
    expect(alert.textContent).toContain('درخواستی ثبت نشد');
    expect(within(dialog).queryByRole('button', { name: 'کپی کد پیگیری' })).toBeNull();
    expect(setItem.mock.calls.filter(([key]) => key === DEMO_STORAGE_KEY)).toHaveLength(0);
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });
});
