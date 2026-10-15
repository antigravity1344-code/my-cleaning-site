// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { orderService } from './services/orderService';
import type { BookingOrder } from './types';
import App from './App';
import { DEMO_STORAGE_KEY, LEGACY_DATA_NOTICE, LEGACY_STORAGE_KEYS } from './services/pii';
import { ADDON_OPTIONS } from './data/mockData';

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

/**
 * نرمال‌سازی متن برای سنجش ادعاها، تا تغییر قالب نوشتاری از آزمون فرار نکند:
 *   • ارقام فارسی (۰-۹) و عربی (٠-٩) → لاتین
 *   • حذف نیم‌فاصله، کشیده و اعراب (مثل تنوینِ «کاملاً»)؛ یکسان‌سازی ی/ک عربی
 *   • حذف جداکننده هزارگان بین ارقام (, ٬ ، فاصله و فاصله‌های باریک)
 *   • یکسان‌سازی ممیز (٫ و / بین دو رقم) به «.»
 */
const normalizeClaimText = (text: string): string =>
  text
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[ً-ٰٟـ‌‍‎‏]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/(\d)[,٬، \u00a0\u202f\u2009\u2007.](?=\d{3}(?:\D|$))/g, '$1')
    .replace(/(\d)[٫/](?=\d)/g, '$1.')
    .replace(/\s+/g, ' ');

/**
 * عدد مستقل (نه بخشی از عدد بزرگ‌تر، مثل قیمت ۴۵۰٬۰۰۰ یا اعشار ۴۵۰٫۵).
 * جداکننده (. , ، ٬ ٫ /) فقط وقتی «ادامه عدد» حساب می‌شود که در سمت دیگرش رقم باشد؛
 * علامت نگارشی پایان جمله یا فهرست (مثل «۲۵٬۰۰۰، مشتری» یا «۴۵۰. متخصص») عدد را پنهان نمی‌کند.
 */
const NUMBER_JOINERS = '.,٬،٫/';
const standaloneNumber = (value: string): RegExp =>
  new RegExp(
    `(?<!\\d)(?<!\\d[${NUMBER_JOINERS}])${value.replace('.', '\\.')}(?!\\d)(?![${NUMBER_JOINERS}]\\d)`,
  );

const HERO_UNVERIFIED_FIGURES = ['25000', '450', '4.9'];
const UNVERIFIED_SUPPORT_CLAIM = /24 ?ساعت|شبانه ?روز/;

describe('SAFETY-005 — claim normalizer catches formatting variants', () => {
  it.each([
    ['+۲۵,۰۰۰', '25000'], ['+۲۵٬۰۰۰', '25000'], ['٢٥،٠٠٠', '25000'], ['25 000', '25000'], ['25,000', '25000'],
    ['۴۵۰', '450'], ['٤٥٠', '450'],
    ['۴.۹', '4.9'], ['۴٫۹', '4.9'], ['۴/۹', '4.9'], ['٤٫٩', '4.9'], ['4.9', '4.9'],
  ])('%s is detected as %s', (variant, figure) => {
    expect(normalizeClaimText(`امتیاز ${variant} مشتری`)).toMatch(standaloneNumber(figure));
  });


  it.each([
    ['۲۵ ۰۰۰', '25000'], ['٢٥ ٠٠٠', '25000'], ['25.000', '25000'],
    ['۴۵۰', '450'], ['٤٥٠', '450'], ['450', '450'],
    ['۴٫۹', '4.9'], ['٤٫٩', '4.9'], ['4.9', '4.9'],
  ])('T2: thin spaces and Persian/Arabic/Latin figures %s normalize to %s', (variant, figure) => {
    expect(normalizeClaimText('تعداد ' + variant)).toMatch(standaloneNumber(figure));
  });

  it.each(['۴۵۰٫۵', '٤٥٠٫٥', '450.5', '۱٬۴۵۰٬۰۰۰', '١٬٤٥٠٬٠٠٠', '1 450 000', '1.450.000', '۱٬۴۵۰٬۰۰۰ و ۲۵٬۰۰۰٬۰۰۰'])(
    'T2: larger/decimal value %s is never mistaken for a standalone 450',
    (variant) => {
      expect(normalizeClaimText('قیمت ' + variant)).not.toMatch(standaloneNumber('450'));
    },
  );

  it.each([
    ['+۲۵٬۰۰۰، مشتری راضی', '25000'],
    ['+۲۵,۰۰۰. مشتری', '25000'],
    ['۴۵۰، متخصص', '450'],
    ['۴۵۰. متخصص', '450'],
    ['متخصص،۴۵۰', '450'],
    ['امتیاز ۴٫۹.', '4.9'],
    ['امتیاز ۴/۹، عالی', '4.9'],
    ['(۴۵۰)', '450'],
  ])('F3: trailing/leading punctuation does not hide %s (→ %s)', (variant, figure) => {
    expect(normalizeClaimText(variant)).toMatch(standaloneNumber(figure));
  });

  it.each([
    ['۴۵۰٫۵', '450'], ['۱۴۵۰', '450'], ['۴٫۹۵', '4.9'], ['۱۴٫۹', '4.9'], ['۱٬۴۵۰٬۰۰۰، تومان', '450'], ['۲۵۰٬۰۰۰، تومان', '25000'],
  ])('F3: %s is still not mistaken for a standalone %s', (variant, figure) => {
    expect(normalizeClaimText(variant)).not.toMatch(standaloneNumber(figure));
  });

  it('does not flag unrelated larger numbers such as prices', () => {
    const price = normalizeClaimText('۶۴۰٬۰۰۰ تومان و ۱٬۴۵۰٬۰۰۰ تومان و ۱۴.۹');
    for (const figure of HERO_UNVERIFIED_FIGURES) {
      expect(price).not.toMatch(standaloneNumber(figure));
    }
  });

  it('catches support-hour and re-clean variants (ZWNJ, diacritics, spacing)', () => {
    expect(normalizeClaimText('پشتیبانی ۲۴‌ساعته')).toMatch(UNVERIFIED_SUPPORT_CLAIM);
    expect(normalizeClaimText('پشتیبانی شبانه‌روزی')).toMatch(UNVERIFIED_SUPPORT_CLAIM);
    expect(normalizeClaimText('نظافت مجدد کاملاً رایگان')).toMatch(/نظافت ?مجدد.{0,30}رایگان/);
  });
});

describe('SAFETY-005 — actual rendered marketing copy', () => {
  it('does not display unverified Hero statistics in any digit/separator format', () => {
    render(<App />);
    const hero = document.querySelector('main')?.firstElementChild;
    expect(hero).toBeTruthy();
    const heroText = normalizeClaimText(hero?.textContent ?? '');
    for (const figure of HERO_UNVERIFIED_FIGURES) {
      expect(heroText).not.toMatch(standaloneNumber(figure));
    }
  });

  it('footer has no free re-clean promise, support-hours, line-count or "approved pricing" claims', () => {
    render(<App />);
    const footer = normalizeClaimText(document.querySelector('footer')?.textContent ?? '');
    expect(footer).not.toMatch(/نظافت ?مجدد.{0,30}رایگان/);
    expect(footer).not.toMatch(UNVERIFIED_SUPPORT_CLAIM);
    expect(footer).not.toMatch(/\d+ ?خط/);
    expect(footer).not.toContain('مصوب');
  });

  it('no support-hours claim is rendered outside the explicit "pending evidence" section', () => {
    render(<App />);
    // منوی موبایل را باز می‌کنیم تا متن آن هم در DOM باشد.
    fireEvent.click(screen.getByRole('button', { name: 'باز کردن منو' }));
    const page = document.body.cloneNode(true) as HTMLElement;
    // بخش «ضمانت‌ها و ادعاهای در انتظار مستندسازی» عمداً می‌گوید این ادعا هنوز تأیید نشده است.
    page.querySelector('#why-us')?.remove();
    expect(normalizeClaimText(page.textContent ?? '')).not.toMatch(UNVERIFIED_SUPPORT_CLAIM);
  });

  it('F1: the identity-verification card does not assert the check is performed', () => {
    render(<App />);
    const whyUs = normalizeClaimText(document.querySelector('#why-us')?.textContent ?? '');
    expect(whyUs).toContain(normalizeClaimText('احراز هویت متخصصین'));
    expect(whyUs).not.toMatch(/احراز هویت[^.؛]{0,120}انجام می ?شود/);
    expect(whyUs).not.toContain(normalizeClaimText('در سامانه عملیاتی پاک‌شو انجام'));
  });

  it('F2: service cards and every service detail make no unverified equipment, result or policy claims', () => {
    render(<App />);
    const services = document.querySelector('#services') as HTMLElement;
    const detailButtons = Array.from(services.querySelectorAll('button')).filter((b) =>
      /جزئیات خدمت/.test(b.textContent ?? ''),
    );
    expect(detailButtons.length).toBeGreaterThanOrEqual(6);

    // متن کارت‌ها + متن جزئیات هر خدمت پس از باز کردن آن (پنجره جزئیات داخل #services رندر می‌شود).
    // عمداً فقط #services سنجیده می‌شود: محتوای «پکیج مواد شوینده» در محاسبه‌گر فهرست اقلام فروشی است.
    const rendered: string[] = [services.textContent ?? ''];
    for (const button of detailButtons) {
      fireEvent.click(button);
      const detail = services.querySelector('div.fixed.inset-0');
      expect(detail).not.toBeNull();
      rendered.push(detail?.textContent ?? '');
    }
    const text = normalizeClaimText(rendered.join(' '));

    const unverifiedClaims = [
      'نانو', 'مکنده صنعتی', 'پولیشر', 'خشک‌کن قوی', 'بدون ایجاد اختلال', 'ابزار ایمن',
      'صددرصد', 'آسیب نمی‌زنند', 'ارگانیک', 'انعام', 'ضربتی', 'بسیار دقیق',
    ];
    for (const claim of unverifiedClaims) {
      expect(text, claim).not.toContain(normalizeClaimText(claim));
    }
  });

  it('F2: the appliance add-on does not claim organic detergents', () => {
    render(<App />);
    expect(normalizeClaimText(document.body.textContent ?? '')).not.toContain('ارگانیک');
  });

  it('F2-R1: every optional add-on card in the calculator is free of unverified tool/equipment claims', () => {
    render(<App />);
    const calculator = document.querySelector('#calculator') as HTMLElement;
    expect(calculator).not.toBeNull();

    // پکیج مواد شوینده (detergents) عمداً مستثناست: بازبینی #6201281981 فهرست اقلام آن را
    // در حالت Demo به‌عنوان «فهرست نمونه اقلام پکیج» پذیرفت. این آزمون فقط کارت افزونه‌های
    // اختیاری را می‌سنجد که شرح انجام کار دارند.
    const optionalAddons = ADDON_OPTIONS.filter((addon) => addon.id !== 'detergents');
    expect(optionalAddons.length).toBeGreaterThan(0);

    const toolClaims = ['نانو', 'اسفنج جادویی', 'ارگانیک', 'دستگاه', 'مکنده', 'پولیشر'];
    for (const addon of optionalAddons) {
      const titleEl = Array.from(calculator.querySelectorAll('span')).find(
        (el) => el.textContent?.trim() === addon.title,
      );
      // کارت باید واقعاً در DOM رندر شده باشد (نه فقط در داده).
      expect(titleEl, `add-on card not rendered: ${addon.id}`).toBeTruthy();
      const card = titleEl!.closest('div.rounded-2xl') as HTMLElement;
      expect(card, `add-on card container not found: ${addon.id}`).toBeTruthy();
      expect(card.textContent).toContain(addon.description);

      const cardText = normalizeClaimText(card.textContent ?? '');
      for (const claim of toolClaims) {
        expect(cardText, `${addon.id}: ${claim}`).not.toContain(normalizeClaimText(claim));
      }
    }
  });

  it('service detail does not present the base rate as "approved"', () => {
    render(<App />);
    const services = document.querySelector('#services') as HTMLElement;
    fireEvent.click(Array.from(services.querySelectorAll('button')).find((b) => /جزئیات خدمت/.test(b.textContent ?? ''))!);
    expect(normalizeClaimText(document.body.textContent ?? '')).not.toContain('مصوب');
  });
});


/**
 * T1: actual <App/> state with deliberately unsettled Promise-based rating/cancel.
 * These mocks simulate delayed storage at the service boundary; neither production
 * data nor network calls are used.
 */
describe('SAFETY-005 T1 — deferred rating/cancel cannot leak across order scopes', { timeout: 20000 }, () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  }

  const sampleOrders = (): BookingOrder[] => {
    const base = {
      createdAt: '2026-10-15T10:00:00.000Z', status: 'pending', serviceId: 'home-standard',
      serviceTitle: 'نظافت نمونه', hours: 4, date: 'امروز', totalPrice: 100000,
      customerName: 'ک. ن.', customerPhone: '0912***000', address: 'نمونه',
      cleanerGender: 'no-pref', paymentStatus: 'unpaid', recordType: 'demo',
    };
    return [
      { ...base, id: 'demo-a', trackingCode: 'DEMO-ORDER-A' },
      { ...base, id: 'demo-b', trackingCode: 'DEMO-ORDER-B' },
    ] as BookingOrder[];
  };
  const trackerButton = (tracker: HTMLElement, text: string): HTMLButtonElement => {
    const button = Array.from(tracker.querySelectorAll('button')).find(x => x.textContent?.includes(text));
    if (!button) throw new Error('Missing tracker control: ' + text);
    return button;
  };

  it.each([
    ['rating', 'resolve', 'switch'],
    ['rating', 'reject', 'switch'],
    ['rating', 'resolve', 'close'],
    ['rating', 'reject', 'close'],
    ['cancel', 'resolve', 'switch'],
    ['cancel', 'reject', 'switch'],
    ['cancel', 'resolve', 'close'],
    ['cancel', 'reject', 'close'],
  ] as const)('%s %s after %s never displays stale pending/error/success on the new scope', async (operation, settlement, boundary) => {
    const orders = sampleOrders();
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(orders));
    const delayed = deferred<BookingOrder>();
    const spy = vi.spyOn(orderService, operation === 'rating' ? 'submitOrderRating' : 'cancelOrder')
      .mockImplementation(() => delayed.promise);
    const confirmSpy = operation === 'cancel' ? vi.spyOn(window, 'confirm').mockReturnValue(true) : null;
    try {
      render(<App />);
      const tracker = openTracker();
      await vi.waitFor(() => {
        expect(tracker.textContent).toContain('DEMO-ORDER-A');
        expect(tracker.querySelector('textarea')).not.toBeNull();
      });
      if (operation === 'rating') {
        fireEvent.change(tracker.querySelector('textarea')!, { target: { value: 'SECRET-A-TEXT' } });
        fireEvent.click(trackerButton(tracker, 'ثبت امتیاز'));
      } else {
        fireEvent.click(trackerButton(tracker, 'لغو رکورد نمایشی'));
      }
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe('demo-a');
      expect(tracker.textContent).toContain(operation === 'rating' ? 'در حال ثبت...' : 'در حال لغو...');
      expect(tracker.textContent).not.toContain('ستاره در همین مرورگر ثبت شد');
      expect(tracker.querySelector('[role="alert"]')).toBeNull();

      if (boundary === 'switch') fireEvent.click(trackerButton(tracker, 'DEMO-ORDER-B'));
      else {
        fireEvent.click(Array.from(tracker.querySelectorAll('button')).find(x => x.getAttribute('aria-label') === 'بستن')!);
        openTracker();
      }

      await act(async () => {
        if (settlement === 'resolve') delayed.resolve({
          ...orders[0],
          ...(operation === 'rating' ? { userRating: 5 } : { status: 'cancelled' }),
        } as BookingOrder);
        else delayed.reject(new Error('synthetic storage denial'));
        await Promise.resolve();
      });

      const current = Array.from(document.querySelectorAll('div.fixed.inset-0.z-50'))
        .find(x => x.textContent?.includes('رهگیری آزمایشی')) as HTMLElement;
      expect(current).toBeTruthy();
      if (boundary === 'switch') {
        expect(current.textContent).toContain('DEMO-ORDER-B');
        expect(current.querySelector('textarea')).not.toBeNull();
      }
      expect(current.textContent).not.toContain('SECRET-A-TEXT');
      expect(current.textContent).not.toContain('در حال ثبت...');
      expect(current.textContent).not.toContain('در حال لغو...');
      expect(current.querySelector('[role="alert"]')).toBeNull();
      if (operation === 'rating' && boundary === 'switch') {
        expect(current.textContent).not.toContain('ستاره در همین مرورگر ثبت شد');
      }
    } finally {
      spy.mockRestore();
      confirmSpy?.mockRestore();
    }
  });

  it('rating with unavailable storage shows an error, not early success', async () => {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(sampleOrders()));
    render(<App />);
    const tracker = openTracker();
    await vi.waitFor(() => expect(tracker.querySelector('textarea')).not.toBeNull());
    const blocked = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    try {
      fireEvent.click(trackerButton(tracker, 'ثبت امتیاز'));
      await vi.waitFor(() => {
        expect(tracker.querySelector('[role="alert"]')?.textContent).toContain('ثبت امتیاز ناموفق بود');
      });
      expect(tracker.textContent).not.toContain('ستاره در همین مرورگر ثبت شد');
    } finally {
      blocked.mockRestore();
    }
  });
});


describe('SAFETY-005 C1–C5 — active UI does not promise unsupported operations', () => {
  it('does not render unverified contact links, personal contact details, or expert promises', () => {
    render(<App />);
    expect(document.querySelectorAll('a[href^="tel:"]')).toHaveLength(0);
    expect(document.body.textContent).not.toContain('۰۲۱-۸۸۹۹۰۰۱۱');
    expect(document.body.textContent).not.toContain('info@paksho.ir');
    expect(document.body.textContent).not.toContain('تقاطع فاطمی');
    const hero = document.querySelector('main')?.firstElementChild;
    expect(hero?.textContent).not.toContain('مجرب و معتمد');
    expect(document.querySelector('#services')?.textContent).not.toContain('تجهیزات درجه‌یک');
  });

  it('renders FAQ answers as unverified/demo, not as operative guarantees', () => {
    render(<App />);
    const faq = document.querySelector('#faq')!;
    expect(faq.textContent).toContain('احراز هویت، استعلام سوابق و پوشش بیمه‌ای هنوز');
    const select = (text: string) => {
      const button = Array.from(faq.querySelectorAll('button')).find(x => x.textContent?.includes(text));
      if (!button) throw new Error('FAQ not found: ' + text);
      fireEvent.click(button);
    };
    select('لغو یا تغییر زمان سفارش');
    expect(faq.textContent).toContain('مهلت، هزینه و امکان تغییر زمان سفارش واقعی هنوز');
    expect(faq.textContent).not.toContain('تا ۲ ساعت قبل');
    select('در صورت عدم رضایت');
    expect(faq.textContent).toContain('هیچ ضمانت رضایت');
    expect(faq.textContent).not.toContain('ما تضمین ۱۰۰٪ رضایت داریم');
    select('نحوه پرداخت هزینه');
    expect(faq.textContent).toContain('پرداخت آنلاین، پرداخت در محل');
    expect(faq.textContent).not.toContain('می‌توانید هزینه را در انتهای ثبت سفارش');
  });
});
