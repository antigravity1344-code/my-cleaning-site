// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { CLEANING_TIPS, SERVICES_LIST } from './data/mockData';

/**
 * دسترس‌پذیری پنجره‌های داخل بخش‌های صفحه — روی مسیر واقعی `<App />`:
 * جزئیات خدمت، مطلب مجله نظافت، ثبت نظر.
 *
 * همان معیارهای پنجره‌های اصلی: role=dialog با نام، فوکوس داخل پنجره، چرخش Tab،
 * بستن با Escape و بازگشت فوکوس، و inert بودن پس‌زمینه تا وقتی پنجره باز است.
 * این پنجره‌ها با portal بیرون از پس‌زمینه رندر می‌شوند تا خودشان inert نشوند.
 */

// همان شبیه‌سازی رفتار مرورگر که در App.dialogA11y.test.tsx آمده: focus() داخل inert اثری ندارد.
const nativeFocus = HTMLElement.prototype.focus;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
    if (this.closest('[inert]')) return;
    nativeFocus.call(this, options);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface PageModalCase {
  label: string;
  title: string;
  opener: () => HTMLElement;
}

const CASES: PageModalCase[] = [
  {
    label: 'جزئیات خدمت',
    title: SERVICES_LIST[0].title,
    opener: () => screen.getAllByRole('button', { name: /جزئیات خدمت/ })[0],
  },
  {
    label: 'مطلب مجله',
    title: CLEANING_TIPS[0].title,
    opener: () => screen.getAllByRole('button', { name: /مطالعه دستورالعمل کامل/ })[0],
  },
  {
    label: 'ثبت نظر',
    title: 'ثبت نظر و تجربه نظافت',
    opener: () => screen.getByRole('button', { name: /ثبت نظر و تجربه شما/ }),
  },
];

const isInert = (element: Element): boolean => element.closest('[inert]') !== null;
const background = (): HTMLElement[] =>
  ['header', 'main', 'footer'].map((selector) => document.querySelector(selector) as HTMLElement);

const open = (modalCase: PageModalCase): { opener: HTMLElement; dialog: HTMLElement } => {
  const opener = modalCase.opener();
  opener.focus();
  expect(document.activeElement).toBe(opener);
  fireEvent.click(opener);
  return { opener, dialog: screen.getByRole('dialog', { name: modalCase.title }) };
};

describe.each(CASES)('پنجره‌ی $label', (modalCase) => {
  it('پنجره‌ی مودال با نام است، دکمه‌ی بستن نام دارد و فوکوس داخل آن است', () => {
    render(<App />);
    const { dialog } = open(modalCase);

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(dialog).getAllByRole('button', { name: 'بستن' }).length).toBeGreaterThanOrEqual(1);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('تا وقتی باز است پس‌زمینه inert است و خود پنجره نه؛ Escape می‌بندد، پس‌زمینه فعال و فوکوس به بازکننده برمی‌گردد', async () => {
    render(<App />);
    background().forEach((element) => expect(isInert(element)).toBe(false));

    const { opener, dialog } = open(modalCase);

    background().forEach((element) => expect(isInert(element)).toBe(true));
    expect(isInert(opener)).toBe(true);
    expect(isInert(dialog)).toBe(false);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    background().forEach((element) => expect(isInert(element)).toBe(false));
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('Tab از آخرین عنصر به اولین و Shift+Tab از اولین به آخرین می‌چرخد', () => {
    render(<App />);
    const { dialog } = open(modalCase);
    const tabbables = Array.from(dialog.querySelectorAll<HTMLElement>(TABBABLE));
    expect(tabbables.length).toBeGreaterThan(1);
    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe('انتقال از جزئیات خدمت به فرم رزرو', () => {
  it('پس‌زمینه در انتقال فعال نمی‌شود، فقط فرم رزرو باز است و بستن آن فوکوس را به دکمه‌ی «جزئیات خدمت» برمی‌گرداند', async () => {
    render(<App />);
    const { opener, dialog } = open(CASES[0]);

    const inertChanges = new MutationObserver(() => undefined);
    inertChanges.observe(document.body, { attributes: true, attributeFilter: ['inert'], subtree: true });
    fireEvent.click(within(dialog).getByRole('button', { name: /رزرو آنلاین این خدمت/ }));
    const records = inertChanges.takeRecords();
    inertChanges.disconnect();

    const booking = screen.getByRole('dialog', { name: 'ثبت درخواست خدمات نظافت' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(records).toHaveLength(0);
    expect(booking.contains(document.activeElement)).toBe(true);
    background().forEach((element) => expect(isInert(element)).toBe(true));

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    background().forEach((element) => expect(isInert(element)).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe('فرم ثبت نظر', () => {
  it('فیلدها برچسبِ وصل‌شده دارند و ستاره‌ها نام و وضعیت انتخاب دارند', () => {
    render(<App />);
    const { dialog } = open(CASES[2]);

    for (const label of ['نام و نام خانوادگی', 'نوع خدمت دریافت شده', 'متن نظر و جزئیات تجربه']) {
      expect(within(dialog).getByLabelText(label)).toBeTruthy();
    }
    const stars = within(dialog).getByRole('group', { name: 'میزان رضایت و امتیاز شما' });
    const three = within(stars).getByRole('button', { name: '۳ ستاره' });
    fireEvent.click(three);
    expect(three.getAttribute('aria-pressed')).toBe('true');
    expect(within(stars).getByRole('button', { name: '۵ ستاره' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('پس از ثبت، پیام موفقیت اعلام می‌شود و بسته شدن خودکار، فوکوس را به بازکننده برمی‌گرداند', async () => {
    render(<App />);
    const { opener, dialog } = open(CASES[2]);

    fireEvent.change(within(dialog).getByLabelText('نام و نام خانوادگی'), { target: { value: 'کاربر آزمایشی' } });
    fireEvent.change(within(dialog).getByLabelText('متن نظر و جزئیات تجربه'), { target: { value: 'نظر آزمایشی' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ارسال و ثبت نظر' }));

    expect(within(dialog).getByRole('status').textContent).toContain('نظر آزمایشی شما ثبت شد');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  });
});
