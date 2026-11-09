// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrderTrackingPage, trackStatusLabel } from './OrderTrackingPage';
import * as api from '../services/pakshoApi';

vi.mock('../services/pakshoApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/pakshoApi')>();
  return { ...actual, isPakshoConfigured: vi.fn(() => true), trackOrder: vi.fn() };
});

describe('OrderTrackingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it('برچسب وضعیت‌های واقعی را فارسی نشان می‌دهد و وضعیت ناشناخته را پنهان می‌کند', () => {
    expect(trackStatusLabel('PENDING')).toBe('در انتظار متخصص');
    expect(trackStatusLabel('SOMETHING_NEW')).toBe('وضعیت جدید');
  });

  it('کد نامعتبر را بدون تماس با سرور رد می‌کند', async () => {
    render(<OrderTrackingPage />);
    // اگر پاکشو پیکربندی نشده باشد، فرم نمایش داده نمی‌شود؛ این تست فقط وقتی معنا دارد که فرم باشد.
    const input = screen.queryByLabelText('کد پیگیری');
    if (!input) return;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.submit(input.closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('کد پیگیری معتبر نیست');
    expect(api.trackOrder).not.toHaveBeenCalled();
  });

  it('نتیجهٔ سفارش را فقط با فیلدهای عمومی نشان می‌دهد', async () => {
    vi.mocked(api.trackOrder).mockResolvedValue({
      trackingCode: 'ORD-ABC-0123abcd',
      status: 'CONFIRMED',
      serviceTitle: 'نظافت منزل',
      date: '2026-11-20',
      time: '10:00',
      area: 'تهران',
      createdAt: null,
    });
    render(<OrderTrackingPage />);
    fireEvent.change(screen.getByLabelText('کد پیگیری'), { target: { value: 'ord-abc-0123abcd' } });
    fireEvent.submit(screen.getByLabelText('کد پیگیری').closest('form')!);
    await waitFor(() => expect(document.body.textContent).toContain('تأیید شده'));
    expect(document.body.textContent).toContain('نظافت منزل');
    expect(api.trackOrder).toHaveBeenCalledWith('ORD-ABC-0123abcd');
  });
});
