// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
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
 *   • دکمه بستن نام قابل‌خواندن دارد.
 *
 * محدوده: jsdom رفتار پیش‌فرض Tab مرورگر را اجرا نمی‌کند؛ بنابراین فقط
 * «چرخش در مرزها» (آخرین ← اولین و برعکس) و محافظ focusin آزموده می‌شود.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
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

    trigger.focus();

    expect(dialog.contains(document.activeElement)).toBe(true);
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
    fireEvent.click(applyButton);

    const bookingDialog = screen.getByRole('dialog', { name: DIALOGS[0].title });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(bookingDialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(aiTrigger);
  });
});
