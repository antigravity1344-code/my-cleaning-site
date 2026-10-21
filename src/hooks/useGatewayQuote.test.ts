// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Quote, QuoteRequest } from '../services/customerOrders/contract';
import { isQuoteExpired, useGatewayQuote } from './useGatewayQuote';

/** پیش‌فاکتور ساختگی؛ مبلغ و مرجع فقط برای تشخیص پاسخ‌ها از هم است. */
const quoteFor = (reference: string, total: number): Quote => ({
  serviceTitle: 'خدمت آزمایشی',
  hours: 4,
  hourlyRate: total / 4,
  serviceBase: total,
  addonLines: [],
  addonsTotal: 0,
  detergentCost: 0,
  subtotal: total,
  discountLines: [],
  discountsTotal: 0,
  total,
  isProvisional: false,
  reference,
});

const selection = (hours: number, promoCode?: string): QuoteRequest => ({
  serviceId: 'home-standard',
  hours,
  addonIds: [],
  hasDetergentPackage: true,
  promoCode,
});

/** getQuote که پاسخ هر درخواست را خود آزمون، به هر ترتیبی، می‌دهد. */
const deferredQuotes = () => {
  const pending: Array<{ request: QuoteRequest; resolve: (quote: Quote) => void; reject: (error: unknown) => void }> = [];
  const getQuote = vi.fn(
    (request: QuoteRequest) =>
      new Promise<Quote>((resolve, reject) => {
        pending.push({ request, resolve, reject });
      }),
  );
  return { pending, getQuote };
};

describe('useGatewayQuote — پیش‌فاکتور زنده از gateway', () => {
  it('پاسخ دیررسیدهٔ انتخاب قبلی نادیده گرفته می‌شود، حتی اگر بعد از پاسخ تازه برسد', async () => {
    const { pending, getQuote } = deferredQuotes();
    const { result, rerender } = renderHook(({ s }) => useGatewayQuote(getQuote, s, true), {
      initialProps: { s: selection(4) },
    });
    expect(result.current.state.status).toBe('loading');

    rerender({ s: selection(6) });
    expect(getQuote).toHaveBeenCalledTimes(2);
    expect(pending[1].request.hours).toBe(6);

    // اول پاسخ تازه، بعد پاسخ کهنه.
    await act(async () => pending[1].resolve(quoteFor('NEW', 600)));
    await act(async () => pending[0].resolve(quoteFor('OLD', 400)));

    expect(result.current.quote?.reference).toBe('NEW');
    expect(result.current.quote?.total).toBe(600);
  });

  it('تا وقتی پاسخ انتخاب فعلی نرسیده، پیش‌فاکتور انتخاب قبلی «جاری» نیست', async () => {
    const { pending, getQuote } = deferredQuotes();
    const { result, rerender } = renderHook(({ s }) => useGatewayQuote(getQuote, s, true), {
      initialProps: { s: selection(4) },
    });
    await act(async () => pending[0].resolve(quoteFor('A', 400)));
    expect(result.current.quote?.reference).toBe('A');

    // تغییر کد تخفیف: پیش‌فاکتور قبلی دیگر برای این انتخاب‌ها معتبر نیست.
    rerender({ s: selection(4, 'PAK1403') });
    expect(result.current.quote).toBeNull();
    expect(result.current.state.status).toBe('loading');

    // پاسخ کهنه‌ای که پس از تغییر برسد هم جای پاسخ انتخاب فعلی را نمی‌گیرد.
    await act(async () => pending[0].resolve(quoteFor('A-again', 400)));
    expect(result.current.quote).toBeNull();

    await act(async () => pending[1].resolve(quoteFor('B', 300)));
    expect(result.current.quote?.reference).toBe('B');
  });

  it('خطای پاسخ کهنه هم وضعیت فعلی را خراب نمی‌کند', async () => {
    const { pending, getQuote } = deferredQuotes();
    const { result, rerender } = renderHook(({ s }) => useGatewayQuote(getQuote, s, true), {
      initialProps: { s: selection(4) },
    });
    rerender({ s: selection(5) });
    await act(async () => pending[1].resolve(quoteFor('CURRENT', 500)));
    await act(async () => pending[0].reject(new Error('پاسخ کهنه با خطا')));
    expect(result.current.state.status).toBe('ready');
    expect(result.current.quote?.reference).toBe('CURRENT');
  });

  it('refresh برای همان انتخاب‌ها پیش‌فاکتور تازه می‌گیرد', async () => {
    const { pending, getQuote } = deferredQuotes();
    const { result } = renderHook(() => useGatewayQuote(getQuote, selection(4), true));
    await act(async () => pending[0].resolve(quoteFor('FIRST', 400)));

    act(() => result.current.refresh());
    expect(getQuote).toHaveBeenCalledTimes(2);
    await act(async () => pending[1].resolve(quoteFor('SECOND', 450)));
    expect(result.current.quote?.reference).toBe('SECOND');
  });

  it('وقتی فعال نیست درخواستی نمی‌فرستد و چیزی نشان نمی‌دهد', () => {
    const { getQuote } = deferredQuotes();
    const { result } = renderHook(() => useGatewayQuote(getQuote, selection(4), false));
    expect(getQuote).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('idle');
    expect(result.current.quote).toBeNull();
  });

  it('isQuoteExpired فقط با زمان انقضای اعلام‌شدهٔ بک‌اند می‌سنجد', () => {
    const quote = { ...quoteFor('Q', 1), expiresAt: '2026-10-21T10:00:00.000Z' };
    expect(isQuoteExpired(quote, Date.parse('2026-10-21T09:59:59.999Z'))).toBe(false);
    expect(isQuoteExpired(quote, Date.parse('2026-10-21T10:00:00.000Z'))).toBe(true);
    expect(isQuoteExpired(quoteFor('NO-EXPIRY', 1), Date.parse('2099-01-01T00:00:00Z'))).toBe(false);
  });
});
