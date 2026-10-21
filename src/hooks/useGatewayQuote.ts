import { useCallback, useEffect, useRef, useState } from 'react';
import type { Quote, QuoteRequest } from '../services/customerOrders/contract';

/**
 * پیش‌فاکتور زنده از gateway برای همان انتخاب‌هایی که فرم الان نشان می‌دهد.
 *
 * قواعد:
 *   • هر تغییر انتخاب‌ها (خدمت، ساعت، افزودنی، بسته، کد تخفیف) یک درخواست تازه می‌فرستد و
 *     پیش‌فاکتور قبلی دیگر «جاری» نیست؛
 *   • پاسخ دیررسیدهٔ یک درخواست قدیمی (پاسخ کهنه) نادیده گرفته می‌شود، حتی اگر بعد از پاسخ
 *     تازه برسد؛
 *   • `isExpired` فقط با ساعت مرورگر می‌سنجد؛ تصمیم نهایی دربارهٔ اعتبار با بک‌اند است.
 *
 * هیچ مبلغی در مرورگر حساب نمی‌شود؛ این هوک فقط پاسخ بک‌اند را نگه می‌دارد.
 */
export type GatewayQuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; quote: Quote }
  | { status: 'error'; error: unknown };

export interface GatewayQuote {
  state: GatewayQuoteState;
  /** پیش‌فاکتورِ آماده برای همین انتخاب‌ها؛ در غیر این صورت `null`. */
  quote: Quote | null;
  /** درخواست دوباره برای همین انتخاب‌ها (مثلاً پس از انقضا یا تغییر قیمت). */
  refresh: () => void;
}

export const selectionFingerprint = (selection: QuoteRequest): string =>
  JSON.stringify({
    serviceId: selection.serviceId,
    hours: selection.hours,
    addonIds: selection.addonIds,
    hasDetergentPackage: selection.hasDetergentPackage,
    promoCode: selection.promoCode ?? '',
  });

export const isQuoteExpired = (quote: Quote, now: number = Date.now()): boolean =>
  Boolean(quote.expiresAt) && now >= Date.parse(quote.expiresAt as string);

export function useGatewayQuote(
  getQuote: ((request: QuoteRequest) => Promise<Quote>) | undefined,
  selection: QuoteRequest,
  active: boolean,
): GatewayQuote {
  const fingerprint = selectionFingerprint(selection);
  const [state, setState] = useState<{ fingerprint: string | null; value: GatewayQuoteState }>({
    fingerprint: null,
    value: { status: 'idle' },
  });
  const [refreshCount, setRefreshCount] = useState(0);
  /** شمارهٔ آخرین درخواست؛ پاسخی که شماره‌اش با این یکی نباشد کهنه است. */
  const latestRequest = useRef(0);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  useEffect(() => {
    const requestId = ++latestRequest.current;
    if (!active) return;
    if (!getQuote) {
      setState({ fingerprint, value: { status: 'error', error: new Error('پیش‌فاکتور در دسترس نیست.') } });
      return;
    }
    setState({ fingerprint, value: { status: 'loading' } });
    getQuote(selectionRef.current).then(
      (quote) => {
        if (requestId === latestRequest.current) setState({ fingerprint, value: { status: 'ready', quote } });
      },
      (error: unknown) => {
        if (requestId === latestRequest.current) setState({ fingerprint, value: { status: 'error', error } });
      },
    );
  }, [active, fingerprint, getQuote, refreshCount]);

  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  // وضعیتِ متعلق به انتخاب‌های دیگر هرگز به‌جای انتخاب‌های فعلی نشان داده نمی‌شود.
  const current: GatewayQuoteState =
    !active ? { status: 'idle' } : state.fingerprint === fingerprint ? state.value : { status: 'loading' };

  return {
    state: current,
    quote: current.status === 'ready' ? current.quote : null,
    refresh,
  };
}
