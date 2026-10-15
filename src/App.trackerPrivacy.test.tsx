// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { DEMO_STORAGE_KEY, LEGACY_DATA_NOTICE, LEGACY_STORAGE_KEYS } from './services/pii';

/**
 * یافته‌های ۱ و ۲ مأموریت PAKSHO-WEBSITE-SAFETY-003 — از مسیر واقعی App.
 *
 * این فایل «پنجره درخواست‌های آزمایشی» را از داخل `<App />` باز می‌کند و بررسی
 * می‌کند که:
 *   • متن بازخوردی که کاربر در فرم می‌نویسد، هرگز در localStorage ذخیره نمی‌شود؛
 *   • داده ساختگی نسخه قبلی نه نمایش داده می‌شود، نه حذف، نه منتقل.
 */

const LEGACY_KEY = LEGACY_STORAGE_KEYS[0];
const LEGACY_VALUE = JSON.stringify([
  {
    id: 'ord-legacy-1',
    trackingCode: 'PAK-84920',
    customerName: 'مشتری قدیمی نسخه قبل',
    customerPhone: '۰۹۳۵۰۰۰۱۱۲۲',
    address: 'بلوار پاکنژاد، خیابان هجدهم، پلاک ۱۲',
  },
]);

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** همه مودال‌های بازشده در DOM. */
const openModals = (): HTMLElement[] =>
  Array.from(document.querySelectorAll('div.fixed.inset-0.z-50')) as HTMLElement[];

/** مودال رزرو (نه پنجره درخواست‌های آزمایشی) را پیدا می‌کند. */
const getBookingModal = (): HTMLElement => {
  const modal = openModals().find((item) => /فرم آزمایشی رزرو/.test(item.textContent ?? ''));
  if (!modal) throw new Error('مودال رزرو در DOM پیدا نشد.');
  return modal;
};

/** پنجره درخواست‌های آزمایشی را از نوار بالای App باز می‌کند. */
const openTracker = (): HTMLElement => {
  const header = document.querySelector('header') ?? document.body;
  const button = Array.from(header.querySelectorAll('button')).find((item) =>
    /درخواست‌های آزمایشی/.test(item.textContent ?? ''),
  );
  if (!button) throw new Error('دکمه «درخواست‌های آزمایشی» در نوار بالا پیدا نشد.');
  fireEvent.click(button);

  const modal = openModals().find((item) => /رهگیری آزمایشی/.test(item.textContent ?? ''));
  if (!modal) throw new Error('پنجره درخواست‌های آزمایشی باز نشد.');
  return modal;
};

/** کاربر را داخل App تا مرحله فاکتور می‌برد و سفارش نمایشی را ثبت می‌کند. */
const createDemoOrderThroughApp = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /ادامه در فرم آزمایشی رزرو/ }));

  const modal = document.querySelector('div.fixed.inset-0.z-50') as HTMLElement;
  for (let step = 0; step < 3; step += 1) {
    fireEvent.click(
      Array.from(modal.querySelectorAll('button')).find((item) => /مرحله بعد/.test(item.textContent ?? ''))!,
    );
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
  fireEvent.click(
    Array.from(modal.querySelectorAll('button')).find((item) => /مرحله بعد/.test(item.textContent ?? ''))!,
  );
  fireEvent.click(
    Array.from(modal.querySelectorAll('button')).find((item) => /تایید نهایی و ثبت سفارش/.test(item.textContent ?? ''))!,
  );
};

/** پس از ثبت موفق (که غیرهمگام است)، صفحه موفقیت مودال رزرو را می‌بندد. */
const closeBookingModal = async (): Promise<void> => {
  await vi.waitFor(() => {
    expect(getBookingModal().textContent).toContain('بستن و بازگشت به سایت');
  });
  const modal = getBookingModal();
  fireEvent.click(
    Array.from(modal.querySelectorAll('button')).find((item) => /بستن و بازگشت به سایت/.test(item.textContent ?? ''))!,
  );
};

describe('پنجره درخواست‌های آزمایشی از مسیر App', () => {
  it('متن بازخورد نوشته‌شده در فرم، در مقدار واقعی ذخیره‌شده ظاهر نمی‌شود', async () => {
    render(<App />);
    createDemoOrderThroughApp();
    await closeBookingModal();

    const tracker = openTracker();

    // سفارش تازه پس از به‌روزرسانی وضعیت App به‌صورت خودکار انتخاب می‌شود.
    await vi.waitFor(() => {
      expect(tracker.querySelector('textarea')).not.toBeNull();
    });

    const textarea = tracker.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'لطفا زنگ بزنید ۰۹۱۲۳۴۵۶۷۸۹، خیابان ولیعصر پلاک ۲۵' },
    });
    fireEvent.click(
      Array.from(tracker.querySelectorAll('button')).find((item) =>
        /ثبت امتیاز/.test(item.textContent ?? ''),
      )!,
    );

    const stored = localStorage.getItem(DEMO_STORAGE_KEY) ?? '';
    expect(stored).not.toContain('۰۹۱۲۳۴۵۶۷۸۹');
    expect(stored).not.toContain('خیابان ولیعصر');
    expect(stored).not.toContain('userFeedback');

    // امتیاز عددی حفظ شده است و تأیید به کاربر نمایش داده می‌شود.
    await vi.waitFor(() => {
      expect(tracker.textContent).toContain('ستاره در همین مرورگر ثبت شد');
    });
    expect(stored).toMatch(/"userRating":5|"userRating": ?5/);
  });

  it('داده نسخه قبلی نه نمایش داده می‌شود و نه حذف می‌ماند دست‌نخورده', () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_VALUE);
    render(<App />);

    const tracker = openTracker();

    // محتوای داده قدیمی هرگز در رابط کاربری نمایش داده نمی‌شود.
    expect(tracker.textContent).not.toContain('مشتری قدیمی نسخه قبل');
    expect(tracker.textContent).not.toContain('۰۹۳۵۰۰۰۱۱۲۲');
    expect(tracker.textContent).not.toContain('بلوار پاکنژاد');

    // فقط یک اطلاع‌رسانی شفاف درباره وجود آن داده دیده می‌شود.
    expect(tracker.textContent).toContain(LEGACY_DATA_NOTICE);

    // و مقدار قدیمی دست‌نخورده باقی مانده است.
    expect(localStorage.getItem(LEGACY_KEY)).toBe(LEGACY_VALUE);
  });

  it('کد پیگیری سفارش نسخه قبلی در فهرست آزمایشی پیدا نمی‌شود', () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_VALUE);
    render(<App />);

    const tracker = openTracker();
    const searchInput = tracker.querySelector('input[type="text"], input:not([type])') as HTMLInputElement;
    expect(searchInput).not.toBeNull();
    fireEvent.change(searchInput, { target: { value: 'PAK-84920' } });
    fireEvent.submit(searchInput.closest('form') as HTMLFormElement);

    expect(tracker.textContent).toContain('یافت نشد');
    expect(localStorage.getItem(LEGACY_KEY)).toBe(LEGACY_VALUE);
  });

  it('در نبود داده قدیمی، هیچ اطلاع‌رسانی اضافه‌ای نمایش داده نمی‌شود', () => {
    render(<App />);

    const tracker = openTracker();
    expect(tracker.textContent).not.toContain(LEGACY_DATA_NOTICE);
  });
});


describe('SAFETY-005 — actual App storage failures', () => {
  it.each(['unavailable', 'quota'] as const)('does not show booking success or a tracking code when storage is %s', async (reason) => {
    const accessor = reason === 'unavailable'
      ? vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); })
      : null;
    const quota = reason === 'quota'
      ? vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); })
      : null;
    try {
      render(<App />);
      createDemoOrderThroughApp();
      await vi.waitFor(() => {
        expect(getBookingModal().textContent).toMatch(/ذخیره‌سازی محلی مرورگر ناموفق بود/);
      });
      expect(getBookingModal().textContent).not.toContain('بستن و بازگشت به سایت');
      expect(getBookingModal().textContent).not.toMatch(/DEMO-[A-Z0-9-]{5,}/);
    } finally {
      accessor?.mockRestore();
      quota?.mockRestore();
    }
  });
});

describe('SAFETY-005 — tracker ephemeral state with two synthetic orders', () => {
  it('clears feedback text and the submitted/error states across switching and reopen', async () => {
    const base = {
      createdAt: '2026-10-15T10:00:00.000Z', status: 'pending', serviceId: 'home-standard',
      serviceTitle: 'نظافت آزمایشی', hours: 4, date: '۱۴۰۵/۰۷/۲۴',
      totalPrice: 100000, customerName: 'کاربر نمونه', customerPhone: '09120000000',
      address: 'نمونه', cleanerGender: 'no-pref', paymentStatus: 'unpaid', recordType: 'demo',
    };
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify([
      { ...base, id: 'demo-a', trackingCode: 'DEMO-ORDER-A' },
      { ...base, id: 'demo-b', trackingCode: 'DEMO-ORDER-B' },
    ]));
    render(<App />);
    const tracker = openTracker();
    await vi.waitFor(() => expect(tracker.querySelector('textarea')).not.toBeNull());
    fireEvent.change(tracker.querySelector('textarea')!, { target: { value: 'PRIVATE-ORDER-A-FEEDBACK' } });
    fireEvent.click(Array.from(tracker.querySelectorAll('button')).find(b => /ثبت امتیاز/.test(b.textContent ?? ''))!);
    await vi.waitFor(() => expect(tracker.textContent).toContain('ستاره در همین مرورگر ثبت شد'));

    fireEvent.click(Array.from(tracker.querySelectorAll('button')).find(b => b.textContent?.includes('DEMO-ORDER-B'))!);
    await vi.waitFor(() => {
      expect(tracker.textContent).not.toContain('PRIVATE-ORDER-A-FEEDBACK');
      expect(tracker.querySelector('textarea')).not.toBeNull();
      expect(tracker.querySelector('textarea')!.value).toBe('');
    });
    fireEvent.change(tracker.querySelector('textarea')!, { target: { value: 'PRIVATE-ORDER-B-FEEDBACK' } });
    fireEvent.click(Array.from(tracker.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'بستن')!);
    const reopened = openTracker();
    await vi.waitFor(() => {
      expect(reopened.textContent).not.toContain('PRIVATE-ORDER-B-FEEDBACK');
      expect(reopened.textContent).not.toContain('PRIVATE-ORDER-A-FEEDBACK');
    });
  });
});


/**
 * SAFETY-005 follow-up — یافته‌های A و B بازبینی مستقل.
 * رتبه‌دهی و لغو از مسیر واقعی App، با شکست نوشتن در localStorage.
 */
describe('SAFETY-005 follow-up — rating/cancel storage failures from the real App path', { timeout: 20000 }, () => {
  const seedOneOrder = (): void => {
    const base = {
      createdAt: '2026-10-15T10:00:00.000Z', status: 'pending', serviceId: 'home-standard',
      serviceTitle: 'نظافت آزمایشی', hours: 4, date: 'امروز',
      totalPrice: 100000, customerName: 'ک. ن.', customerPhone: '0912***000',
      address: 'نمونه', cleanerGender: 'no-pref', paymentStatus: 'unpaid', recordType: 'demo',
    };
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify([{ ...base, id: 'demo-a', trackingCode: 'DEMO-ORDER-A' }]));
  };

  /** rejectionهای مدیریت‌نشده را در طول آزمون جمع می‌کند. */
  const trackUnhandledRejections = () => {
    const seen: unknown[] = [];
    const listener = (reason: unknown) => { seen.push(reason); };
    process.on('unhandledRejection', listener);
    return { seen, stop: () => process.off('unhandledRejection', listener) };
  };

  /** فرصت می‌دهد تا Promiseها و رویداد unhandledRejection در Node تخلیه شوند. */
  const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 50));

  /** رندر کامل App در jsdom زیر بار CPU کند است؛ مهلت بیشتر از پیش‌فرض ۱ ثانیه. */
  const WAIT = { timeout: 5000 };

  const quotaOnWrite = () =>
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

  it('A: on QuotaExceededError the rating shows a visible error, no success, nothing stored, no unhandled rejection', async () => {
    seedOneOrder();
    const rejections = trackUnhandledRejections();
    const storedBefore = localStorage.getItem(DEMO_STORAGE_KEY);
    try {
      render(<App />);
      const tracker = openTracker();
      await vi.waitFor(() => expect(tracker.querySelector('textarea')).not.toBeNull(), WAIT);
      fireEvent.change(tracker.querySelector('textarea')!, { target: { value: 'PRIVATE-FEEDBACK-A' } });

      const setItem = quotaOnWrite();
      fireEvent.click(Array.from(tracker.querySelectorAll('button')).find((b) => /ثبت امتیاز/.test(b.textContent ?? ''))!);

      await vi.waitFor(() => {
        expect(tracker.querySelector('[role="alert"]')?.textContent ?? '').toMatch(/ثبت امتیاز ناموفق بود/);
      }, WAIT);
      await flushAsync();

      expect(tracker.textContent).not.toContain('ستاره در همین مرورگر ثبت شد');
      // متن بازخورد هرگز به لایه ذخیره‌سازی نمی‌رسد.
      for (const call of setItem.mock.calls) {
        expect(String(call[1])).not.toContain('PRIVATE-FEEDBACK-A');
      }
      setItem.mockRestore();
      expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(storedBefore);
      expect(rejections.seen).toHaveLength(0);
    } finally {
      rejections.stop();
      vi.restoreAllMocks();
    }
  });

  it('A: success is still shown after a real save (no regression)', async () => {
    seedOneOrder();
    const rejections = trackUnhandledRejections();
    try {
      render(<App />);
      const tracker = openTracker();
      await vi.waitFor(() => expect(tracker.querySelector('textarea')).not.toBeNull(), WAIT);
      fireEvent.click(Array.from(tracker.querySelectorAll('button')).find((b) => /ثبت امتیاز/.test(b.textContent ?? ''))!);
      await vi.waitFor(() => expect(tracker.textContent).toContain('ستاره در همین مرورگر ثبت شد'), WAIT);
      await flushAsync();
      expect(tracker.querySelector('[role="alert"]')).toBeNull();
      expect(localStorage.getItem(DEMO_STORAGE_KEY) ?? '').toMatch(/"userRating":5/);
      expect(rejections.seen).toHaveLength(0);
    } finally {
      rejections.stop();
    }
  });

  it.each(['quota', 'unavailable'] as const)(
    'B: cancelling with storage %s shows a visible error, never a cancelled state, and no unhandled rejection',
    async (reason) => {
      seedOneOrder();
      const rejections = trackUnhandledRejections();
      try {
        render(<App />);
        const tracker = openTracker();
        await vi.waitFor(() => expect(tracker.textContent).toContain('لغو رکورد نمایشی'), WAIT);

        vi.spyOn(window, 'confirm').mockReturnValue(true);
        if (reason === 'quota') {
          quotaOnWrite();
        } else {
          vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
            throw new Error('blocked');
          });
        }
        fireEvent.click(Array.from(tracker.querySelectorAll('button')).find((b) => /لغو رکورد نمایشی/.test(b.textContent ?? ''))!);

        await vi.waitFor(() => {
          expect(tracker.querySelector('[role="alert"]')?.textContent ?? '').toMatch(/لغو رکورد ناموفق بود/);
        }, WAIT);
        await flushAsync();

        expect(tracker.textContent).not.toContain('لغو شده است');
        expect(rejections.seen).toHaveLength(0);
      } finally {
        rejections.stop();
        vi.restoreAllMocks();
      }
      // رکورد ذخیره‌شده دست‌نخورده باقی مانده است.
      expect(localStorage.getItem(DEMO_STORAGE_KEY) ?? '').toContain('"status":"pending"');
    },
  );

  it('A/B: errors are cleared when switching orders and on close', async () => {
    seedOneOrder();
    const existing = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!);
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify([...existing, { ...existing[0], id: 'demo-b', trackingCode: 'DEMO-ORDER-B' }]));
    const rejections = trackUnhandledRejections();
    try {
      render(<App />);
      const tracker = openTracker();
      await vi.waitFor(() => expect(tracker.querySelector('textarea')).not.toBeNull(), WAIT);
      const setItem = quotaOnWrite();
      fireEvent.click(Array.from(tracker.querySelectorAll('button')).find((b) => /ثبت امتیاز/.test(b.textContent ?? ''))!);
      await vi.waitFor(() => expect(tracker.querySelector('[role="alert"]')).not.toBeNull(), WAIT);
      setItem.mockRestore();

      fireEvent.click(Array.from(tracker.querySelectorAll('button')).find((b) => b.textContent?.includes('DEMO-ORDER-B'))!);
      await vi.waitFor(() => expect(tracker.querySelector('[role="alert"]')).toBeNull(), WAIT);

      fireEvent.click(Array.from(tracker.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'بستن')!);
      const reopened = openTracker();
      expect(reopened.querySelector('[role="alert"]')).toBeNull();
      await flushAsync();
      expect(rejections.seen).toHaveLength(0);
    } finally {
      rejections.stop();
      vi.restoreAllMocks();
    }
  });
});

describe('SAFETY-005 — actual rendered marketing copy', () => {
  it('does not display unverified Hero statistics or the free re-clean promise', () => {
    render(<App />);
    const hero = document.querySelector('main')?.firstElementChild;
    expect(hero).toBeTruthy();
    const heroText = hero?.textContent ?? '';
    expect(heroText).not.toContain('۲۵,۰۰۰');
    expect(heroText).not.toContain('۴۵۰');
    expect(heroText).not.toContain('۴.۹');
    expect(document.querySelector('footer')?.textContent ?? '').not.toContain('نظافت مجدد کاملا رایگان');
  });
});
