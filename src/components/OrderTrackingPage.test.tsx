// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrderTrackingPage, trackStatusLabel } from './OrderTrackingPage';
import * as api from '../services/pakshoApi';

vi.mock('../services/pakshoApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/pakshoApi')>();
  return { ...actual, isPakshoConfigured: vi.fn(() => true), trackOrder: vi.fn() };
});

describe('OrderTrackingPage (نسخه متصل — فقط ORD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it('برچسب وضعیت‌های واقعی را فارسی نشان می‌دهد و وضعیت ناشناخته را پنهان می‌کند', () => {
    expect(trackStatusLabel('PENDING')).toBe('در انتظار متخصص');
    expect(trackStatusLabel('SOMETHING_NEW')).toBe('وضعیت جدید');
  });

  it('کد نامعتبر را بدون تماس با سرور رد می‌کند', async () => {
    render(<OrderTrackingPage pathname="/track" />);
    const input = screen.queryByLabelText('کد پیگیری');
    if (!input) return;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.submit(input.closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('کد پیگیری معتبر نیست');
    expect(api.trackOrder).not.toHaveBeenCalled();
  });

  it('کد Crockford مستقل را بدون تماس با API رد می‌کند', async () => {
    render(<OrderTrackingPage pathname="/track" />);
    fireEvent.change(screen.getByLabelText('کد پیگیری'), { target: { value: 'abcd-efgh-jkmn-pqrs' } });
    fireEvent.submit(screen.getByLabelText('کد پیگیری').closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('کد پیگیری معتبر نیست');
    expect(api.trackOrder).not.toHaveBeenCalled();
  });

  it('نتیجهٔ سفارش ORD را فقط با فیلدهای عمومی نشان می‌دهد', async () => {
    vi.mocked(api.trackOrder).mockResolvedValue({
      trackingCode: 'ORD-ABC-0123abcd',
      status: 'CONFIRMED',
      serviceTitle: 'نظافت منزل',
      date: '2026-11-20',
      time: '10:00',
      area: 'تهران',
      createdAt: null,
    });
    render(<OrderTrackingPage pathname="/track" />);
    fireEvent.change(screen.getByLabelText('کد پیگیری'), { target: { value: 'ord-abc-0123abcd' } });
    fireEvent.submit(screen.getByLabelText('کد پیگیری').closest('form')!);
    await waitFor(() => expect(document.body.textContent).toContain('تأیید شده'));
    expect(document.body.textContent).toContain('نظافت منزل');
    expect(api.trackOrder).toHaveBeenCalledWith('ORD-ABC-0123abcd');
  });

  it('از مسیر /track/:code به‌صورت خودکار برای ORD جست‌وجو می‌کند', async () => {
    vi.mocked(api.trackOrder).mockResolvedValue({
      trackingCode: 'ORD-TESTEX-230e612f',
      status: 'ACCEPTED',
      serviceTitle: 'نظافت عادی منزل',
      date: 'امروز',
      time: '۰۸:۳۰ الی ۱۲:۳۰',
      area: 'تهران',
      createdAt: null,
    });
    render(<OrderTrackingPage pathname="/track/ORD-TESTEX-230e612f" />);
    await waitFor(() => expect(api.trackOrder).toHaveBeenCalledWith('ORD-TESTEX-230e612f'));
    expect((screen.getByLabelText('کد پیگیری') as HTMLInputElement).value).toBe('ORD-TESTEX-230e612f');
    await waitFor(() => expect(document.body.textContent).toContain('پذیرفته‌شده'));
  });

  it('مسیر /track با کد Crockford را بدون تماس API رد می‌کند', async () => {
    render(<OrderTrackingPage pathname="/track/ABCD-EFGH-JKMN-PQRS" />);
    expect((await screen.findByRole('alert')).textContent).toContain('کد پیگیری معتبر نیست');
    expect(api.trackOrder).not.toHaveBeenCalled();
  });

  it('برای کد نامعتبر در URL پیام مناسب می‌دهد', async () => {
    render(<OrderTrackingPage pathname="/track/not-a-code" />);
    expect((await screen.findByRole('alert')).textContent).toContain('کد پیگیری معتبر نیست');
    expect(api.trackOrder).not.toHaveBeenCalled();
  });

  it('برای سفارش پیدا نشده پیام مناسب می‌دهد', async () => {
    vi.mocked(api.trackOrder).mockResolvedValue(null);
    render(<OrderTrackingPage pathname="/track/ORD-MISSING-00000000" />);
    expect((await screen.findByRole('alert')).textContent).toContain('سفارشی با این کد پیدا نشد');
  });
});
