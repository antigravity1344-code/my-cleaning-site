// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { FAQ_LIST } from './data/mockData';

/**
 * وضعیت باز/بسته برای صفحه‌خوان — منوی موبایل و پرسش‌های متداول (مسیر واقعی App).
 * پیش از این، صفحه‌خوان نمی‌فهمید منو یا پاسخ یک پرسش باز است یا بسته، و دکمه‌ی منو
 * حلقه‌ی فوکوس را با focus:outline-hidden پنهان می‌کرد.
 */

afterEach(cleanup);

describe('منوی موبایل', () => {
  it('دکمه‌ی منو وضعیت باز/بسته و بخش کنترل‌شده را اعلام می‌کند', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: 'باز کردن منو' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.className).not.toContain('outline-hidden');

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('بستن منو');
    const controlled = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(controlled).not.toBeNull();
    expect(within(controlled as HTMLElement).getAllByRole('button').length).toBeGreaterThan(0);

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(button.getAttribute('aria-controls') ?? '')).toBeNull();
  });
});

describe('منوی موبایل — پیمایش و فوکوس پس از انتخاب گزینه', () => {
  // همان رفتار مرورگر: focus() روی عنصر داخل inert نادیده گرفته می‌شود.
  const nativeFocus = HTMLElement.prototype.focus;
  const shimInertFocus = () =>
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
      if (this.closest('[inert]')) return;
      nativeFocus.call(this, options);
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openMenu = () => {
    const toggle = screen.getByRole('button', { name: 'باز کردن منو' });
    toggle.focus();
    fireEvent.click(toggle);
    const menuId = toggle.getAttribute('aria-controls') ?? '';
    return { toggle, menuId, menu: document.getElementById(menuId) as HTMLElement };
  };

  it('بخش مقصد پس از بسته شدن منو اندازه‌گیری می‌شود و زیر هدر چسبان قرار می‌گیرد', () => {
    render(<App />);
    const { toggle, menuId, menu } = openMenu();

    const header = document.querySelector('header') as HTMLElement;
    const calculator = document.getElementById('calculator') as HTMLElement;
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this === header ? 141 : 0;
    });
    let menuPresentWhenMeasured: boolean | null = null;
    const nativeRect = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this === calculator) {
        menuPresentWhenMeasured = document.getElementById(menuId) !== null;
        return { top: 6000, bottom: 6800, left: 0, right: 375, width: 375, height: 800, x: 0, y: 6000, toJSON: () => ({}) } as DOMRect;
      }
      return nativeRect.call(this);
    });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    fireEvent.click(within(menu).getByRole('button', { name: 'محاسبه آنلاین قیمت' }));

    expect(menuPresentWhenMeasured).toBe(false);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 6000 - 141, behavior: 'smooth' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it.each([
    ['رزرو فوری نظافت', 'ثبت درخواست خدمات نظافت'],
    ['مشاور هوشمند', 'مشاور تخمین زمان (نسخه آزمایشی)'],
  ])('پنجره‌ای که از گزینه‌ی «%s» منو باز شده، هنگام بسته شدن فوکوس را به دکمه‌ی منو برمی‌گرداند', async (item, title) => {
    shimInertFocus();
    render(<App />);
    const { toggle, menu } = openMenu();
    const option = within(menu).getByRole('button', { name: item });
    option.focus();
    fireEvent.click(option);

    const dialog = screen.getByRole('dialog', { name: title });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: title })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(toggle));
  });
});

describe('پرسش‌های متداول', () => {
  it('هر پرسش وضعیت باز/بسته دارد و به پاسخ خودش اشاره می‌کند', () => {
    render(<App />);
    const faq = document.querySelector('#faq') as HTMLElement;
    const first = within(faq).getByRole('button', { name: FAQ_LIST[0].question });

    expect(first.getAttribute('aria-expanded')).toBe('true');
    const answer = document.getElementById(first.getAttribute('aria-controls') ?? '');
    expect(answer?.textContent).toContain(FAQ_LIST[0].answer.slice(0, 20));

    fireEvent.click(first);
    expect(first.getAttribute('aria-expanded')).toBe('false');

    const second = within(faq).getByRole('button', { name: FAQ_LIST[1].question });
    fireEvent.click(second);
    expect(second.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(second.getAttribute('aria-controls') ?? '')?.textContent).toContain(
      FAQ_LIST[1].answer.slice(0, 20),
    );
  });

  it('فیلد جستجو نام دارد و دکمه‌های دسته‌بندی وضعیت انتخاب دارند', () => {
    render(<App />);
    const faq = document.querySelector('#faq') as HTMLElement;
    expect(within(faq).getByRole('textbox', { name: 'جستجو در سوالات متداول' })).toBeTruthy();

    const group = within(faq).getByRole('group', { name: 'دسته‌بندی سوالات' });
    const all = within(group).getByRole('button', { name: 'همه سوالات' });
    const pricing = within(group).getByRole('button', { name: 'قیمت‌گذاری و پرداخت' });
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(pricing.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(pricing);
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(pricing.getAttribute('aria-pressed')).toBe('true');
  });
});
