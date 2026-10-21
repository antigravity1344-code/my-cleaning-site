// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { ADDON_OPTIONS, CLEANERS_LIST, SERVICES_LIST } from './data/mockData';

/**
 * دسترس‌پذیری کنترل‌های فرم رزرو — روی مسیر واقعی `<App />`.
 *
 * پیش از این، نوع خدمت، خدمات جانبی، بسته‌ی شوینده، بازه‌ی زمانی، انتخاب متخصص و
 * روش پرداخت `div` کلیک‌پذیر بودند و با صفحه‌کلید انتخاب نمی‌شدند؛ صفحه‌خوان هم نقش
 * و وضعیت انتخاب آن‌ها را نمی‌فهمید. فیلدهای متنی هم برچسبِ وصل‌شده نداشتند.
 *
 * محدوده: jsdom رفتار بومی کلیدهای جهت/Space روی radio را اجرا نمی‌کند؛ اینجا نقش،
 * نام، وضعیت و اثر انتخاب (تا فاکتور) سنجیده می‌شود. رفتار صفحه‌کلید در مرورگر واقعی
 * جداگانه بررسی شده است (گزارش PR).
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const openBooking = (): HTMLElement => {
  render(<App />);
  fireEvent.click(screen.getAllByRole('button', { name: /رزرو آنلاین نظافت/ })[0]);
  return screen.getByRole('dialog', { name: 'ثبت درخواست خدمات نظافت' });
};

const nextStep = (dialog: HTMLElement): void => {
  fireEvent.click(within(dialog).getByRole('button', { name: /مرحله بعد/ }));
};

const fillContactAndContinue = (dialog: HTMLElement): void => {
  fireEvent.change(within(dialog).getByLabelText(/آدرس دقیق/), { target: { value: 'خیابان نمونه، پلاک ۱' } });
  fireEvent.change(within(dialog).getByLabelText(/نام و نام خانوادگی/), { target: { value: 'کاربر آزمایشی' } });
  fireEvent.change(within(dialog).getByLabelText(/شماره همراه/), { target: { value: '09123456789' } });
  nextStep(dialog);
};

const checkedIn = (group: HTMLElement): HTMLInputElement[] =>
  within(group).getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked) as HTMLInputElement[];

describe('فرم رزرو — هیچ کنترل کلیک‌پذیرِ غیرقابل‌دسترسی نمانده است', () => {
  it('در هر چهار مرحله، هر عنصر کلیک‌پذیر (cursor-pointer) یک کنترل واقعی است', () => {
    const dialog = openBooking();
    const allowed = new Set(['BUTTON', 'LABEL', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);
    const assertNoClickableDivs = (step: number) => {
      const offenders = Array.from(dialog.querySelectorAll<HTMLElement>('.cursor-pointer')).filter(
        (element) => !allowed.has(element.tagName),
      );
      expect(offenders.map((element) => `${step}:${element.tagName}:${element.textContent?.slice(0, 20)}`)).toEqual([]);
    };

    assertNoClickableDivs(1);
    nextStep(dialog);
    assertNoClickableDivs(2);
    nextStep(dialog);
    assertNoClickableDivs(3);
    fillContactAndContinue(dialog);
    assertNoClickableDivs(4);
  });
});

describe('مرحله ۱ — نوع خدمت، ساعت، جنسیت، خدمات جانبی، شوینده', () => {
  it('نوع خدمت یک گروه radio با نام است و انتخاب آن تا فاکتور می‌رسد', () => {
    const dialog = openBooking();
    const group = within(dialog).getByRole('radiogroup', { name: 'نوع خدمت نظافت مورد نظر:' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(SERVICES_LIST.length);
    expect(checkedIn(group)).toHaveLength(1);

    const deep = SERVICES_LIST[1];
    const deepRadio = within(group).getByRole('radio', { name: new RegExp(deep.title.replace(/[()]/g, '\\$&')) });
    fireEvent.click(deepRadio);
    expect((deepRadio as HTMLInputElement).checked).toBe(true);
    expect(checkedIn(group)).toEqual([deepRadio]);

    nextStep(dialog);
    nextStep(dialog);
    fillContactAndContinue(dialog);
    expect(dialog.textContent).toContain(`${deep.title} (`);
  });

  it('اسلایدر ساعت نام و مقدار خوانا دارد', () => {
    const dialog = openBooking();
    const slider = within(dialog).getByRole('slider', { name: 'تعداد ساعت کار نیرو:' });
    expect(slider.getAttribute('aria-valuetext')).toMatch(/^\d+ ساعت$/);
  });

  it('جنسیت متخصص یک گروه radio است', () => {
    const dialog = openBooking();
    const group = within(dialog).getByRole('radiogroup', { name: 'اولویت جنسیت متخصص نظافت:' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    const female = within(group).getByRole('radio', { name: 'نظافتچی خانم' });
    fireEvent.click(female);
    expect(checkedIn(group)).toEqual([female]);
  });

  it('خدمات جانبی و بسته‌ی شوینده checkbox هستند و روی فاکتور اثر می‌گذارند', () => {
    const dialog = openBooking();
    const group = within(dialog).getByRole('group', { name: 'خدمات جانبی (اختیاری):' });
    const optional = ADDON_OPTIONS.filter((addon) => addon.id !== 'detergents');
    const boxes = within(group).getAllByRole('checkbox');
    expect(boxes).toHaveLength(optional.length + 1);

    const firstAddon = within(group).getByRole('checkbox', { name: new RegExp(optional[0].title) });
    expect((firstAddon as HTMLInputElement).checked).toBe(false);
    fireEvent.click(firstAddon);
    expect((firstAddon as HTMLInputElement).checked).toBe(true);

    const detergent = within(group).getByRole('checkbox', { name: /تامین شوینده‌ها/ });
    expect((detergent as HTMLInputElement).checked).toBe(true);
    fireEvent.click(detergent);
    expect((detergent as HTMLInputElement).checked).toBe(false);

    nextStep(dialog);
    nextStep(dialog);
    fillContactAndContinue(dialog);
    expect(dialog.textContent).toContain('خدمات جانبی انتخابی');
    expect(dialog.textContent).not.toContain('پکیج مواد شوینده و دستمال نانو:');
  });
});

describe('مرحله ۲ — روز، بازه‌ی زمانی، متخصص', () => {
  it('روز، بازه‌ی زمانی و متخصص گروه‌های radio با نام هستند و انتخاب در هرکدام یکتاست', () => {
    const dialog = openBooking();
    nextStep(dialog);

    const day = within(dialog).getByRole('radiogroup', { name: 'روز مراجعه نیروی خدماتی:' });
    const slot = within(dialog).getByRole('radiogroup', { name: 'بازه زمانی شروع کار:' });
    const cleaner = within(dialog).getByRole('radiogroup', { name: 'انتخاب متخصص (فهرست نمونه):' });

    expect(within(day).getAllByRole('radio')).toHaveLength(5);
    expect(within(slot).getAllByRole('radio')).toHaveLength(3);
    expect(within(cleaner).getAllByRole('radio')).toHaveLength(4);
    expect(cleaner.getAttribute('aria-describedby')).toBeTruthy();

    for (const group of [day, cleaner]) {
      expect(checkedIn(group)).toHaveLength(1);
    }

    const evening = within(slot).getByRole('radio', { name: /عصر و غروب/ });
    fireEvent.click(evening);
    expect(checkedIn(slot)).toEqual([evening]);

    const sampleCleaner = within(cleaner).getByRole('radio', { name: new RegExp(CLEANERS_LIST[0].name) });
    fireEvent.click(sampleCleaner);
    expect(checkedIn(cleaner)).toEqual([sampleCleaner]);
  });
});

describe('بازه‌ی زمانی پیش‌فرض', () => {
  it('بازه‌ی پیش‌فرض یکی از گزینه‌های فرم است، انتخاب‌شده دیده می‌شود و همان در سفارش ثبت می‌شود', async () => {
    const dialog = openBooking();
    nextStep(dialog);
    const slot = within(dialog).getByRole('radiogroup', { name: 'بازه زمانی شروع کار:' });
    const checked = checkedIn(slot);
    expect(checked).toHaveLength(1);
    const defaultSlotLabel = (checked[0].closest('label')?.textContent ?? '').replace('✓', '').trim();

    nextStep(dialog);
    fillContactAndContinue(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }));
    await within(dialog).findByRole('button', { name: 'کپی کد پیگیری' });

    const stored = JSON.parse(localStorage.getItem('paksho_demo_orders_v2') ?? '[]') as Array<{ timeSlot: string }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].timeSlot).toBe(defaultSlotLabel);
  });
});

describe('رفتن از مرحله ۳ به ۴ نباید سفارش را فوراً ثبت کند', () => {
  /*
   * در مرورگر واقعی، کلیک «مرحله بعد» در مرحله ۳ مستقیماً سفارش را ثبت می‌کرد و مرحله‌ی
   * فاکتور هرگز دیده نمی‌شد: React همان گره‌ی دکمه را در مرحله ۴ به type="submit" تبدیل
   * می‌کند و مرورگر پس از کلیک، رفتار فعال‌سازی را با type جدید اجرا می‌کند. jsdom این
   * بازبررسی را انجام نمی‌دهد؛ پس اینجا خودِ سازوکار محافظ سنجیده می‌شود: کلیک باید
   * preventDefault شده باشد. رفتار واقعی در Chromium جداگانه بررسی شده است (گزارش PR).
   */
  it('کلیک «مرحله بعد» در مرحله ۳ رفتار پیش‌فرض را لغو می‌کند، فاکتور را نشان می‌دهد و چیزی ذخیره نمی‌کند', () => {
    const dialog = openBooking();
    nextStep(dialog);
    nextStep(dialog);
    fireEvent.change(within(dialog).getByLabelText(/آدرس دقیق/), { target: { value: 'خیابان نمونه، پلاک ۱' } });
    fireEvent.change(within(dialog).getByLabelText(/نام و نام خانوادگی/), { target: { value: 'کاربر آزمایشی' } });
    fireEvent.change(within(dialog).getByLabelText(/شماره همراه/), { target: { value: '09123456789' } });

    const notCanceled = fireEvent.click(within(dialog).getByRole('button', { name: /مرحله بعد/ }));

    expect(notCanceled).toBe(false);
    expect(within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ })).toBeTruthy();
    expect(within(dialog).getByRole('radiogroup', { name: 'نحوه پرداخت:' })).toBeTruthy();
    expect(localStorage.getItem('paksho_demo_orders_v2')).toBeNull();
  });
});

describe('مرحله‌ی فاکتور با فشار تکراری یا Enter در کد تخفیف رد نمی‌شود', () => {
  const toInvoice = (dialog: HTMLElement): HTMLElement => {
    nextStep(dialog);
    nextStep(dialog);
    fillContactAndContinue(dialog);
    return within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ });
  };

  it('کلیک دوم یک دوبار-کلیک روی همان جای دکمه سفارش را ثبت نمی‌کند؛ کلیک جداگانه ثبت می‌کند', async () => {
    const dialog = openBooking();
    const confirm = toInvoice(dialog);

    fireEvent.click(confirm, { detail: 2 });
    expect(within(dialog).getByRole('radiogroup', { name: 'نحوه پرداخت:' })).toBeTruthy();
    expect(localStorage.getItem('paksho_demo_orders_v2')).toBeNull();

    fireEvent.click(confirm, { detail: 1 });
    expect(await within(dialog).findByRole('button', { name: 'کپی کد پیگیری' })).toBeTruthy();
  });

  it('تکرار خودکار Enter روی دکمه‌های «مرحله بعد» و «تأیید نهایی» لغو می‌شود', () => {
    const dialog = openBooking();
    const next = within(dialog).getByRole('button', { name: /مرحله بعد/ });
    expect(fireEvent.keyDown(next, { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(next, { key: 'Enter', repeat: false })).toBe(true);

    const confirm = toInvoice(dialog);
    expect(fireEvent.keyDown(confirm, { key: 'Enter', repeat: true })).toBe(false);
    expect(localStorage.getItem('paksho_demo_orders_v2')).toBeNull();
  });

  it('Enter در فیلد کد تخفیف کد را اعمال می‌کند و فرم را ثبت نمی‌کند؛ ناحیه‌ی اعلام از قبل حاضر است', () => {
    const dialog = openBooking();
    toInvoice(dialog);
    const status = within(dialog).getByRole('status');
    expect(status.textContent).toBe('');

    const promo = within(dialog).getByLabelText(/کد تخفیف دارید/);
    fireEvent.change(promo, { target: { value: 'PAK1403' } });
    expect(fireEvent.keyDown(promo, { key: 'Enter' })).toBe(false);

    expect(status.textContent).toContain('PAK1403');
    expect(within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ })).toBeTruthy();
    expect(localStorage.getItem('paksho_demo_orders_v2')).toBeNull();
  });
});

describe('ثبت سفارش — شماره همراه با ارقام فارسی و جلوگیری از ثبت دوباره', () => {
  const storedOrders = (): Array<Record<string, unknown>> => JSON.parse(localStorage.getItem('paksho_demo_orders_v2') ?? '[]');

  const toStep3WithPhone = (dialog: HTMLElement, phone: string): void => {
    nextStep(dialog);
    nextStep(dialog);
    fireEvent.change(within(dialog).getByLabelText(/آدرس دقیق/), { target: { value: 'خیابان نمونه، پلاک ۱' } });
    fireEvent.change(within(dialog).getByLabelText(/نام و نام خانوادگی/), { target: { value: 'کاربر آزمایشی' } });
    fireEvent.change(within(dialog).getByLabelText(/شماره همراه/), { target: { value: phone } });
    nextStep(dialog);
  };

  it.each([
    ['ارقام فارسی', '۰۹۱۲۱۲۳۴۵۶۷'],
    ['ارقام عربی', '٠٩١٢١٢٣٤٥٦٧'],
  ])('همان شماره‌ی معتبر ۱۱ رقمی با %s پذیرفته و ماسک‌شده‌اش ذخیره می‌شود', async (_label, phone) => {
    const dialog = openBooking();
    toStep3WithPhone(dialog, phone);

    expect(within(dialog).queryByRole('alert')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }));
    expect(await within(dialog).findByRole('button', { name: 'کپی کد پیگیری' })).toBeTruthy();

    const orders = storedOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0].customerPhone).toBe('0912***567');
  });

  it('شماره‌ی نامعتبر با ارقام فارسی (۱۰ رقم) همچنان رد می‌شود', () => {
    const dialog = openBooking();
    toStep3WithPhone(dialog, '۰۹۱۲۱۲۳۴۵۶');

    expect(within(dialog).getByRole('alert').textContent).toContain('شماره همراه معتبر');
    expect(within(dialog).queryByRole('button', { name: /تایید نهایی و ثبت سفارش/ })).toBeNull();
    expect(localStorage.getItem('paksho_demo_orders_v2')).toBeNull();
  });

  it('دو کلیک پشت‌سرهم روی «تأیید نهایی» پیش از به‌روز شدن صفحه فقط یک سفارش ثبت می‌کند', async () => {
    const dialog = openBooking();
    toStep3WithPhone(dialog, '09121234567');
    const confirm = within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ });

    // هر دو کلیک در یک act: React بین آن‌ها دوباره رندر نمی‌کند (مثل دو رویداد در یک task مرورگر).
    act(() => {
      confirm.click();
      confirm.click();
    });

    expect(await within(dialog).findByRole('button', { name: 'کپی کد پیگیری' })).toBeTruthy();
    expect(storedOrders()).toHaveLength(1);
  });
});

describe('مرحله ۳ و ۴ — برچسب فیلدها، خطا، پرداخت، کد تخفیف', () => {
  it('همه‌ی فیلدهای مرحله ۳ برچسبِ وصل‌شده دارند و خطای اعتبارسنجی اعلام می‌شود', () => {
    const dialog = openBooking();
    nextStep(dialog);
    nextStep(dialog);

    for (const label of [/^شهر:$/, /منطقه \/ محله/, /آدرس دقیق/, /طبقه و واحد/, /نام و نام خانوادگی/, /شماره همراه/, /توضیحات و نکات خاص/]) {
      expect(within(dialog).getByLabelText(label)).toBeTruthy();
    }

    nextStep(dialog);
    expect(within(dialog).getByRole('alert').textContent).toContain('لطفاً آدرس دقیق');
  });

  it('روش پرداخت گروه radio است؛ پرداخت در محل انتخاب‌شده و پرداخت اینترنتی غیرفعال است', () => {
    const dialog = openBooking();
    nextStep(dialog);
    nextStep(dialog);
    fillContactAndContinue(dialog);

    const payment = within(dialog).getByRole('radiogroup', { name: 'نحوه پرداخت:' });
    const cash = within(payment).getByRole('radio', { name: /پرداخت در محل/ }) as HTMLInputElement;
    const online = within(payment).getByRole('radio', { name: /پرداخت اینترنتی/ }) as HTMLInputElement;
    expect(cash.checked).toBe(true);
    expect(online.disabled).toBe(true);
    expect(online.checked).toBe(false);

    expect(within(dialog).getByLabelText(/کد تخفیف دارید/)).toBeTruthy();
    expect(dialog.querySelector('[aria-current="step"]')?.textContent).toContain('۴. فاکتور و تایید');
  });

  it('دکمه‌ی کپی کد پیگیری در صفحه‌ی موفقیت نام دارد', async () => {
    const dialog = openBooking();
    nextStep(dialog);
    nextStep(dialog);
    fillContactAndContinue(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }));

    expect(await within(dialog).findByRole('button', { name: 'کپی کد پیگیری' })).toBeTruthy();
  });
});
