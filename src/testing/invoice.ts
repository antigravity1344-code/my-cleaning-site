import { waitFor, within } from '@testing-library/react';

/**
 * فقط برای آزمون‌ها.
 *
 * از وقتی فاکتور از `getQuote` لایهٔ اتصال می‌آید، پیش‌فاکتور ناهمگام است و تا رسیدن آن
 * «تأیید نهایی» با `aria-disabled` غیرفعال اعلام می‌شود (ثبت بدون دیدن مبلغ ممکن نیست). این تابع
 * صبر می‌کند تا مبلغ فاکتور نمایش داده شود و دکمهٔ تأیید آماده شود، و همان دکمه را برمی‌گرداند.
 */
export async function waitForInvoice(dialog: HTMLElement): Promise<HTMLButtonElement> {
  let confirm: HTMLButtonElement | null = null;
  await waitFor(() => {
    confirm = within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }) as HTMLButtonElement;
    if (confirm.disabled || confirm.getAttribute('aria-disabled') === 'true') {
      throw new Error('پیش‌فاکتور هنوز نمایش داده نشده است.');
    }
  });
  return confirm as unknown as HTMLButtonElement;
}
