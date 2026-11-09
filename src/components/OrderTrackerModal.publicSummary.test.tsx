// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OrderTrackerModal } from './OrderTrackerModal';
import type { BookingOrder } from '../types';

/**
 * این فایل مسیر جدیدی را می‌سنجد که هنوز در خود App سوار نیست (ر.ک.
 * docs/OPERATIONAL-PLAN.md بخش ۱۵، PR#5): نمای پیگیری عمومی سفارش واقعی
 * (`isPublicSummary`) و بازگشت جست‌وجو به `onLookupByTrackingCode` وقتی
 * کد محلی پیدا نشود. تا وقتی App این prop را پاس نمی‌دهد، این مسیرها در
 * سایت واقعی هرگز اجرا نمی‌شوند؛ این تست فقط خودِ کامپوننت را مستقل می‌سنجد.
 */

afterEach(() => {
  cleanup();
});

const publicOrderFixture: BookingOrder = {
  id: 'PAKA-BCDE-FGHI-JKLM',
  trackingCode: 'PAKA-BCDE-FGHI-JKLM',
  createdAt: '2026-11-09T10:00:00.000Z',
  status: 'confirmed',
  isPublicSummary: true,
  recordType: 'demo',
  paymentStatus: 'unpaid',
  serviceId: 'home-standard',
  serviceTitle: 'نظافت استاندارد منزل',
  cleanerGender: 'no-pref',
  hours: 0,
  selectedAddons: [],
  hasDetergentPackage: false,
  date: '1405/08/25',
  timeSlot: 'عصر',
  cityName: 'تهران',
  district: '',
  address: '',
  unit: '',
  customerName: '',
  customerPhone: '',
  totalPrice: 0,
  discountApplied: 0,
  paymentMethod: 'cash_on_site',
};

const renderModal = (overrides: Partial<ComponentProps<typeof OrderTrackerModal>> = {}) =>
  render(
    <OrderTrackerModal
      isOpen
      onClose={() => {}}
      orders={[]}
      onSubmitOrderRating={async () => ({ ...publicOrderFixture })}
      onCancelOrder={async () => ({ ...publicOrderFixture })}
      {...overrides}
    />
  );

/** پنجره (مودال) باز شده را در DOM پیدا می‌کند. */
const getModal = (): HTMLElement => {
  const modal = document.querySelector('div[role="dialog"]');
  if (!modal) throw new Error('مودال رهگیری در DOM پیدا نشد.');
  return modal as HTMLElement;
};

describe('OrderTrackerModal — پیگیری عمومی سفارش واقعی (isPublicSummary)', () => {
  it('بدون onLookupByTrackingCode، پیام خطای همیشگی نسخه آزمایشی را می‌دهد (رفتار فعلی تغییر نکرده)', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText(/کد پیگیری/), { target: { value: 'ZZZZ' } });
    fireEvent.click(screen.getByRole('button', { name: 'جستجو' }));

    await waitFor(() => {
      expect(getModal().textContent).toContain('هیچ سامانه مرکزی برای رهگیری وجود ندارد');
    });
  });

  it('وقتی onLookupByTrackingCode داده شده، جست‌وجوی محلی ناموفق به آن می‌رود و نمای عمومی رندر می‌شود', async () => {
    const lookup = vi.fn().mockResolvedValue(publicOrderFixture);
    renderModal({ onLookupByTrackingCode: lookup });

    fireEvent.change(screen.getByPlaceholderText(/کد پیگیری/), {
      target: { value: publicOrderFixture.trackingCode },
    });
    fireEvent.click(screen.getByRole('button', { name: 'جستجو' }));

    await waitFor(() => expect(lookup).toHaveBeenCalledWith(publicOrderFixture.trackingCode));

    // نمای عمومی: برچسب وضعیت واقعی دیده می‌شود...
    await waitFor(() => {
      expect(getModal().textContent).toContain('تأیید شد');
    });
    // ...اما نوار پیشرفت ۵مرحله‌ای نمایشی و کارت مالی/تماس نسخه آزمایشی نیستند.
    const text = getModal().textContent ?? '';
    expect(text).not.toContain('مراحل اجرای سفارش');
    expect(text).not.toContain('تومان');
    expect(text).not.toContain('اطلاعات ذخیره‌شده روی همین دستگاه (ماسک‌شده)');
  });

  it('وقتی onLookupByTrackingCode چیزی پیدا نکند (null)، پیام «پیدا نشد» می‌دهد', async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    renderModal({ onLookupByTrackingCode: lookup });

    fireEvent.change(screen.getByPlaceholderText(/کد پیگیری/), { target: { value: 'NOPE-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'جستجو' }));

    await waitFor(() => {
      expect(getModal().textContent).toContain('سفارشی با این کد پیدا نشد.');
    });
  });

  it('لغو شدهٔ واقعی (isPublicSummary) هم فقط برچسب وضعیت را نشان می‌دهد، نه دکمهٔ لغو نمایشی', async () => {
    const cancelledOrder: BookingOrder = { ...publicOrderFixture, status: 'cancelled' };
    const lookup = vi.fn().mockResolvedValue(cancelledOrder);
    renderModal({ onLookupByTrackingCode: lookup });

    fireEvent.change(screen.getByPlaceholderText(/کد پیگیری/), { target: { value: cancelledOrder.trackingCode } });
    fireEvent.click(screen.getByRole('button', { name: 'جستجو' }));

    await waitFor(() => expect(getModal().textContent).toContain('لغو شد'));
    expect(getModal().textContent).not.toContain('لغو رکورد نمایشی');
  });
});
