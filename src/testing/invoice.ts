import { waitFor, within } from '@testing-library/react';

/**
 * فقط برای آزمون‌ها.
 *
 * از وقتی فاکتور از `getQuote` لایهٔ اتصال می‌آید، پیش‌فاکتور ناهمگام است و تا رسیدن آن
 * «تأیید نهایی» غیرفعال می‌ماند (ثبت بدون دیدن مبلغ ممکن نیست). این تابع صبر می‌کند تا مبلغ
 * فاکتور نمایش داده شود و دکمهٔ تأیید فعال شود، و همان دکمه را برمی‌گرداند.
 */
export async function waitForInvoice(dialog: HTMLElement): Promise<HTMLButtonElement> {
  const confirm = within(dialog).getByRole('button', { name: /تایید نهایی و ثبت سفارش/ }) as HTMLButtonElement;
  await waitFor(() => {
    if (confirm.disabled) throw new Error('پیش‌فاکتور هنوز نمایش داده نشده است.');
  });
  return confirm;
}
