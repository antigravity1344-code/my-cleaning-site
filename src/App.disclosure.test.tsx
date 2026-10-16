// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
