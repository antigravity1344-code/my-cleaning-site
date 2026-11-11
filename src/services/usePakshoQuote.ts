import { useEffect, useState } from 'react';
import { getPricingRules, pakshoServiceId, PakshoApiError, requestQuote, type PakshoQuote, type PricingRule } from './pakshoApi';

export const QUOTE_PENDING_TEXT = 'قیمت پس از انتخاب جزئیات نمایش داده می‌شود';

export function quoteErrorText(error: unknown): string {
  if (error instanceof PakshoApiError) {
    if (error.status === 429 && error.retryAfter) {
      const seconds = /^\d+$/.test(error.retryAfter)
        ? Number(error.retryAfter)
        : Math.max(0, Math.ceil((Date.parse(error.retryAfter) - Date.now()) / 1000));
      if (Number.isFinite(seconds)) return `تعداد درخواست‌های قیمت زیاد است. ${seconds.toLocaleString('fa-IR')} ثانیه دیگر دوباره تلاش کنید.`;
    }
    if (error.status === 429 || error.code === 'FEATURE_DISABLED') return error.message;
  }
  return 'قیمت از سرور دریافت نشد. دوباره تلاش کنید.';
}

type Result = { key: string; quote?: PakshoQuote; error?: unknown };

export function usePakshoQuote(enabled: boolean, serviceId: string, hours: number, detergent = false, discountCode?: string) {
  const [rules, setRules] = useState<PricingRule[] | null>(null);
  const [rulesError, setRulesError] = useState<unknown>();
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    if (!enabled || rules) return;
    let active = true;
    setRulesError(undefined);
    getPricingRules().then(
      (data) => { if (active) setRules(data); },
      (error: unknown) => { if (active) setRulesError(error); },
    );
    return () => { active = false; };
  }, [enabled, rules]);

  const model = rules?.find(rule => rule.serviceId === pakshoServiceId(serviceId))?.model;
  const quantity = model === 'fixed' ? 1 : hours;
  const valid = enabled && (model === 'fixed' || model === 'hourly') && Number.isSafeInteger(quantity) && quantity > 0;
  const key = valid ? JSON.stringify([serviceId, quantity, detergent, discountCode]) : '';

  useEffect(() => {
    if (!key) {
      setResult(undefined);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      requestQuote({ serviceId, quantity, options: detergent ? { detergent: true } : {}, discountCode }).then(
        quote => { if (active) setResult({ key, quote }); },
        (error: unknown) => { if (active) setResult({ key, error }); },
      );
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [key, serviceId, quantity, detergent, discountCode]);

  const unavailable = enabled && rules && !model;
  const unsupported = enabled && (model === 'count' || model === 'area');
  return {
    quote: key && result?.key === key ? result.quote : undefined,
    error: enabled ? rulesError ?? (key && result?.key === key ? result.error : undefined) : undefined,
    availabilityMessage: unsupported ? 'برای این خدمت، فرم فعلی جزئیات لازم برای محاسبهٔ قیمت را ندارد.'
      : unavailable ? 'تعرفهٔ این خدمت در دسترس نیست.' : '',
    quantity,
  };
}
