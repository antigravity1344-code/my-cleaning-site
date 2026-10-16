// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

/**
 * دسترس‌پذیری پنجره‌های مودال — روی مسیر واقعی `<App />`.
 *
 * برای هر سه پنجره (رزرو، پیگیری درخواست‌ها، مشاور تخمین زمان) بررسی می‌شود:
 *   • صفحه‌خوان آن را «پنجره» (role=dialog، aria-modal) با عنوان درست می‌شناسد،
 *   • با باز شدن، فوکوس صفحه‌کلید داخل پنجره می‌رود،
 *   • Tab / Shift+Tab در مرزهای پنجره می‌چرخد و به صفحه پشت نمی‌رود،
 *   • Escape پنجره را می‌بندد و فوکوس به دکمه بازکننده برمی‌گردد،
 *   • دکمه بستن نام قابل‌خواندن دارد،
 *   • تا وقتی پنجره باز است، صفحه‌ی پشت آن inert است (از صفحه‌خوان و تعامل خارج
 *     است) و خود پنجره زیر هیچ عنصر inert نیست؛ پس از بستن، پس‌زمینه دوباره فعال
 *     می‌شود و inertِ ازپیش‌موجود دست نمی‌خورد.
 *
 * محدوده: jsdom رفتار پیش‌فرض Tab مرورگر را اجرا نمی‌کند؛ بنابراین فقط
 * «چرخش در مرزها» (آخرین ← اولین و برعکس) و محافظ focusin آزموده می‌شود.
 */

/**
 * jsdom ویژگی inert را برای فوکوس اجرا نمی‌کند، اما مرورگر واقعی (طبق HTML) فراخوانی
 * focus() روی عنصری که داخل inert است را نادیده می‌گیرد. این شبیه‌سازی همان رفتار را
 * می‌سازد تا آزمون‌ها مثل مرورگر واقعی رفتار کنند (مثلاً بازگشت فوکوس در انتقال پنجره‌ها).
 */
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

const tabbablesIn = (dialog: HTMLElement): HTMLElement[] =>
  Array.from(dialog.querySelectorAll<HTMLElement>(TABBABLE));

interface DialogCase {
  label: string;
  title: string;
  open: () => HTMLElement;
}

const DIALOGS: DialogCase[] = [
  {
    label: 'رزرو',
    title: 'ثبت درخواست خدمات نظافت',
    open: () => screen.getAllByRole('button', { name: /رزرو آنلاین نظافت/ })[0],
  },
  {
    label: 'پیگیری درخواست‌ها',
    title: 'درخواست‌های نمایشی همین مرورگر',
    open: () => screen.getAllByRole('button', { name: /درخواست‌های آزمایشی/ })[0],
  },
  {
    label: 'مشاور تخمین زمان',
    title: 'مشاور تخمین زمان (نسخه آزمایشی)',
    open: () => screen.getByRole('button', { name: 'مشاور هوشمند نظافت' }),
  },
];

/** دکمه بازکننده را فوکوس و کلیک می‌کند (مثل کاربر صفحه‌کلید) و پنجره را برمی‌گرداند. */
const openWithKeyboardFocus = (dialogCase: DialogCase): { trigger: HTMLElement; dialog: HTMLElement } => {
  const trigger = dialogCase.open();
  trigger.focus();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: dialogCase.title });
  return { trigger, dialog };
};

describe.each(DIALOGS)('پنجره $label — دسترس‌پذیری', (dialogCase) => {
  it('به‌عنوان پنجره مودال با عنوان درست شناخته می‌شود و دکمه بستن نام دارد', () => {
    render(<App />);
    const { dialog } = openWithKeyboardFocus(dialogCase);

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(dialog).getByRole('button', { name: 'بستن' })).toBeTruthy();
  });

  it('با باز شدن، فوکوس به داخل پنجره منتقل می‌شود', () => {
    render(<App />);
    const { dialog } = openWithKeyboardFocus(dialogCase);

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Escape پنجره را می‌بندد و فوکوس به دکمه بازکننده برمی‌گردد', () => {
    render(<App />);
    const { trigger } = openWithKeyboardFocus(dialogCase);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape حتی وقتی فوکوس روی body افتاده باشد هم پنجره را می‌بندد', () => {
    render(<App />);
    openWithKeyboardFocus(dialogCase);
    (document.activeElement as HTMLElement | null)?.blur();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Tab از آخرین عنصر به اولین و Shift+Tab از اولین به آخرین می‌چرخد', () => {
    render(<App />);
    const { dialog } = openWithKeyboardFocus(dialogCase);
    const tabbables = tabbablesIn(dialog);
    expect(tabbables.length).toBeGreaterThan(1);
    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Shift+Tab از خود پنجره (فوکوس اولیه) به آخرین عنصر داخل پنجره می‌رود', () => {
    render(<App />);
    const { dialog } = openWithKeyboardFocus(dialogCase);
    const tabbables = tabbablesIn(dialog);

    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Shift' });
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(tabbables[tabbables.length - 1]);
  });

  it('اگر فوکوس به صفحه پشت پنجره برود، به پنجره برگردانده می‌شود', () => {
    render(<App />);
    const { trigger, dialog } = openWithKeyboardFocus(dialogCase);

    // focus مستقیم (بدون شبیه‌سازی inert)، مثل مرورگری که inert را پشتیبانی نمی‌کند.
    nativeFocus.call(trigger);

    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

/** عنصرهای نمونه‌ی پس‌زمینه که باید هنگام باز بودن پنجره inert باشند. */
const backgroundSamples = (): HTMLElement[] => {
  const samples = ['header', 'main', 'footer'].map((selector) => document.querySelector<HTMLElement>(selector));
  samples.push(screen.getByRole('button', { name: 'مشاور هوشمند نظافت', hidden: true }));
  samples.forEach((element) => expect(element, 'عنصر نمونه‌ی پس‌زمینه پیدا نشد').toBeTruthy());
  return samples as HTMLElement[];
};

const isInert = (element: Element): boolean => element.closest('[inert]') !== null;

describe.each(DIALOGS)('پنجره $label — پس‌زمینه‌ی inert', (dialogCase) => {
  it('تا وقتی پنجره باز است، پس‌زمینه inert است و خود پنجره نه؛ پس از Escape پس‌زمینه دوباره فعال است', () => {
    render(<App />);
    backgroundSamples().forEach((element) => expect(isInert(element)).toBe(false));

    const { trigger, dialog } = openWithKeyboardFocus(dialogCase);

    backgroundSamples().forEach((element) => expect(isInert(element)).toBe(true));
    expect(isInert(trigger)).toBe(true);
    expect(isInert(dialog)).toBe(false);
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    backgroundSamples().forEach((element) => expect(isInert(element)).toBe(false));
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);
  });

  it('inertی که از قبل روی عنصری بوده، پس از بستن پنجره دقیقاً باقی می‌ماند', () => {
    render(<App />);
    const footer = document.querySelector('footer') as HTMLElement;
    footer.setAttribute('inert', '');

    openWithKeyboardFocus(dialogCase);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(footer.hasAttribute('inert')).toBe(true);
    expect(isInert(document.querySelector('header') as HTMLElement)).toBe(false);
    expect(document.querySelectorAll('[inert]')).toHaveLength(1);
  });
});

describe('انتقال از مشاور تخمین زمان به فرم رزرو', () => {
  it('پس از انتقال، فقط پنجره رزرو باز است، فوکوس داخل آن است و Escape فوکوس را به دکمه مشاور برمی‌گرداند', async () => {
    render(<App />);
    const aiCase = DIALOGS[2];
    const { trigger: aiTrigger, dialog: aiDialog } = openWithKeyboardFocus(aiCase);

    fireEvent.change(within(aiDialog).getByRole('textbox'), {
      target: { value: 'آپارتمان ۸۵ متری نوساز که تازه نقاشی شده' },
    });
    fireEvent.submit(within(aiDialog).getByRole('textbox').closest('form') as HTMLFormElement);

    const applyButton = await within(aiDialog).findByRole(
      'button',
      { name: /انتقال این مشخصات به فرم آزمایشی رزرو/ },
      { timeout: 3000 },
    );
    // هر تغییری در ویژگی inert هنگام انتقال ثبت می‌شود؛ پس‌زمینه نباید حتی یک لحظه فعال شود.
    const inertChanges = new MutationObserver(() => undefined);
    inertChanges.observe(document.body, { attributes: true, attributeFilter: ['inert'], subtree: true });
    fireEvent.click(applyButton);
    const inertRecords = inertChanges.takeRecords();
    inertChanges.disconnect();

    const bookingDialog = screen.getByRole('dialog', { name: DIALOGS[0].title });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(bookingDialog.contains(document.activeElement)).toBe(true);
    expect(inertRecords).toHaveLength(0);
    backgroundSamples().forEach((element) => expect(isInert(element)).toBe(true));
    expect(isInert(bookingDialog)).toBe(false);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(aiTrigger);
    backgroundSamples().forEach((element) => expect(isInert(element)).toBe(false));
  });
});
