// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { ADDON_OPTIONS, SERVICES_LIST } from './data/mockData';

/**
 * دسترس‌پذیری کنترل‌های محاسبه‌گر هزینه و فرم سریع بالای صفحه — مسیر واقعی App.
 *
 * پیش از این: خدمات جانبی و بسته‌ی شوینده‌ی محاسبه‌گر `div` کلیک‌پذیر بودند (با صفحه‌کلید
 * انتخاب نمی‌شدند)؛ نوع خدمت، تعداد اتاق/سرویس و جنسیت دکمه‌هایی بی‌وضعیتِ انتخاب بودند؛
 * دو فهرست کشویی فرم بالای صفحه و دو اسلایدر نام نداشتند.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const calculator = (): HTMLElement => document.querySelector('#calculator') as HTMLElement;
const heroForm = (): HTMLElement =>
  screen.getByRole('button', { name: /ادامه و انتخاب تاریخ و آدرس/ }).closest('form') as HTMLElement;

const checkedIn = (group: HTMLElement): HTMLInputElement[] =>
  within(group).getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked) as HTMLInputElement[];

const readCalculatorTotal = (): string => calculator().querySelector('.text-3xl')?.textContent?.trim() ?? '';

describe('محاسبه‌گر هزینه', () => {
  it('هیچ عنصر کلیک‌پذیری که کنترل واقعی نباشد باقی نمانده است', () => {
    render(<App />);
    const allowed = new Set(['BUTTON', 'LABEL', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);
    const offenders = Array.from(calculator().querySelectorAll<HTMLElement>('.cursor-pointer')).filter(
      (element) => !allowed.has(element.tagName),
    );
    expect(offenders.map((element) => element.textContent?.slice(0, 20))).toEqual([]);
  });

  it('نوع خدمت، تعداد اتاق، تعداد سرویس و جنسیت گروه‌های radio با نام و یک انتخاب هستند', () => {
    render(<App />);
    const section = calculator();
    const groups: Array<[string, number]> = [
      ['۱. نوع خدمت نظافت را انتخاب کنید:', SERVICES_LIST.length],
      ['تعداد اتاق خواب‌ها:', 5],
      ['تعداد سرویس بهداشتی / حمام:', 4],
      ['۳. اولویت جنسیت متخصص:', 3],
    ];
    for (const [name, count] of groups) {
      const group = within(section).getByRole('radiogroup', { name });
      expect(within(group).getAllByRole('radio'), name).toHaveLength(count);
      expect(checkedIn(group), name).toHaveLength(1);
    }
  });

  it('انتخاب نوع خدمت با radio مبلغ برآورد را عوض می‌کند', () => {
    render(<App />);
    const group = within(calculator()).getByRole('radiogroup', { name: '۱. نوع خدمت نظافت را انتخاب کنید:' });
    const before = readCalculatorTotal();
    const deep = within(group).getByRole('radio', { name: new RegExp(SERVICES_LIST[1].title.replace(/[()]/g, '\\$&')) });
    fireEvent.click(deep);
    expect(checkedIn(group)).toEqual([deep]);
    expect(readCalculatorTotal()).not.toBe(before);
  });

  it('خدمات جانبی و بسته‌ی شوینده checkbox با نام هستند و روی مبلغ اثر می‌گذارند', () => {
    render(<App />);
    const group = within(calculator()).getByRole('group', { name: '۴. خدمات جانبی و شوینده (اختیاری):' });
    const optional = ADDON_OPTIONS.filter((addon) => addon.id !== 'detergents');
    expect(within(group).getAllByRole('checkbox')).toHaveLength(optional.length + 1);

    const before = readCalculatorTotal();
    const addon = within(group).getByRole('checkbox', { name: new RegExp(optional[0].title) }) as HTMLInputElement;
    fireEvent.click(addon);
    expect(addon.checked).toBe(true);
    expect(readCalculatorTotal()).not.toBe(before);

    const detergent = within(group).getByRole('checkbox', { name: /تامین کامل شوینده‌ها/ }) as HTMLInputElement;
    expect(detergent.checked).toBe(true);
    fireEvent.click(detergent);
    expect(detergent.checked).toBe(false);
  });

  it('انتخاب تعداد سرویس و جنسیت ثبت می‌شود و جنسیت به فرم رزرو منتقل می‌شود', () => {
    render(<App />);
    const section = calculator();
    const baths = within(section).getByRole('radiogroup', { name: 'تعداد سرویس بهداشتی / حمام:' });
    const threeBaths = within(baths).getByRole('radio', { name: '3' });
    fireEvent.click(threeBaths);
    expect(checkedIn(baths)).toEqual([threeBaths]);

    const gender = within(section).getByRole('radiogroup', { name: '۳. اولویت جنسیت متخصص:' });
    const female = within(gender).getByRole('radio', { name: 'نظافتچی خانم' });
    fireEvent.click(female);
    expect(checkedIn(gender)).toEqual([female]);

    fireEvent.click(screen.getByRole('button', { name: /ادامه در فرم آزمایشی رزرو/ }));
    const booking = screen.getByRole('dialog', { name: 'ثبت درخواست خدمات نظافت' });
    const bookingGender = within(booking).getByRole('radiogroup', { name: 'اولویت جنسیت متخصص نظافت:' });
    expect((within(bookingGender).getByRole('radio', { name: 'نظافتچی خانم' }) as HTMLInputElement).checked).toBe(true);
  });

  it('اسلایدر متراژ نام و مقدار خوانا دارد', () => {
    render(<App />);
    const slider = within(calculator()).getByRole('slider', { name: '۲. متراژ تقریبی فضا:' });
    expect(slider.getAttribute('aria-valuetext')).toMatch(/^\d+ متر مربع$/);
  });
});

describe('فرم سریع بالای صفحه', () => {
  it('فهرست‌های شهر و نوع خدمت برچسب دارند و اسلایدر ساعت نام دارد', () => {
    render(<App />);
    const form = heroForm();
    expect(within(form).getByLabelText('انتخاب شهر').tagName).toBe('SELECT');
    expect(within(form).getByLabelText('نوع خدمت نظافت').tagName).toBe('SELECT');
    const slider = within(form).getByRole('slider', { name: 'مدت زمان مورد نیاز:' });
    expect(slider.getAttribute('aria-valuetext')).toMatch(/^\d+ ساعت$/);
  });

  it('شهر، نوع خدمت و ساعتِ انتخاب‌شده به فرم رزرو منتقل می‌شوند', () => {
    render(<App />);
    const form = heroForm();
    const deep = SERVICES_LIST[1];
    fireEvent.change(within(form).getByLabelText('نوع خدمت نظافت'), { target: { value: deep.id } });
    fireEvent.change(within(form).getByRole('slider', { name: 'مدت زمان مورد نیاز:' }), { target: { value: '8' } });
    fireEvent.change(within(form).getByLabelText('انتخاب شهر'), { target: { value: 'اصفهان' } });
    fireEvent.click(within(form).getByRole('button', { name: /ادامه و انتخاب تاریخ و آدرس/ }));

    const booking = screen.getByRole('dialog', { name: 'ثبت درخواست خدمات نظافت' });
    const service = within(booking).getByRole('radiogroup', { name: 'نوع خدمت نظافت مورد نظر:' });
    expect((within(service).getByRole('radio', { name: new RegExp(deep.title.replace(/[()]/g, '\\$&')) }) as HTMLInputElement).checked).toBe(true);
    expect((within(booking).getByRole('slider', { name: 'تعداد ساعت کار نیرو:' }) as HTMLInputElement).value).toBe('8');

    fireEvent.click(within(booking).getByRole('button', { name: /مرحله بعد/ }));
    fireEvent.click(within(booking).getByRole('button', { name: /مرحله بعد/ }));
    expect((within(booking).getByLabelText(/^شهر:$/) as HTMLSelectElement).value).toBe('اصفهان');
  });

  it('جنسیت یک گروه radio است و انتخاب آن به فرم رزرو منتقل می‌شود', () => {
    render(<App />);
    const form = heroForm();
    const group = within(form).getByRole('radiogroup', { name: 'جنسیت نیروی خدماتی' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(checkedIn(group)).toHaveLength(1);

    const male = within(group).getByRole('radio', { name: 'نظافتچی آقا' });
    fireEvent.click(male);
    expect(checkedIn(group)).toEqual([male]);

    fireEvent.click(within(form).getByRole('button', { name: /ادامه و انتخاب تاریخ و آدرس/ }));
    const booking = screen.getByRole('dialog', { name: 'ثبت درخواست خدمات نظافت' });
    const bookingGender = within(booking).getByRole('radiogroup', { name: 'اولویت جنسیت متخصص نظافت:' });
    expect((within(bookingGender).getByRole('radio', { name: 'نظافتچی آقا' }) as HTMLInputElement).checked).toBe(true);
  });
});
