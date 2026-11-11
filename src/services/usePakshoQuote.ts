import { useEffect, useState } from 'react';
import { getPricingRules, pakshoServiceId, PakshoApiError, requestQuote, type PakshoQuote, type PricingRule } from './pakshoApi';
import { SOFA_PAKSHO_SERVICE_ID, sofaQuoteInput, type SofaFormValues, type SofaPricingMode } from './sofaQuote';

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

type QuoteOptions = Record<string, string | number | boolean>;
type Result = { key: string; quote?: PakshoQuote; error?: unknown };

/**
 * قیمت‌گیری از سرور پاک‌شو. برای مبل‌شویی، ورودی از روی فرم (تعداد و نوع نشیمن) و حالت قیمت‌گذاری سرور ساخته می‌شود.
 * options دقیقاً همان چیزی است که به نقل‌قول و سفارش فرستاده می‌شود.
 */
export function usePakshoQuote(
  enabled: boolean,
  serviceId: string,
  hours: number,
  detergent = false,
  discountCode?: string,
  sofa?: SofaFormValues,
  quoteActive = enabled,
) {
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

  const pakshoId = pakshoServiceId(serviceId);
  const isSofa = pakshoId === SOFA_PAKSHO_SERVICE_ID;
  const rule = rules?.find(r => r.serviceId === pakshoId);
  const model = rule?.model;
  const pricingMode = (rule?.pricingMode ?? null) as SofaPricingMode | null;

  const sofaInput = isSofa && sofa ? sofaQuoteInput(pricingMode, sofa) : null;
  const quantity = isSofa ? (sofaInput?.quantity ?? 0) : model === 'fixed' ? 1 : hours;
  const valid = quoteActive && (isSofa
    ? sofaInput !== null
    : (model === 'fixed' || model === 'hourly') && Number.isSafeInteger(quantity) && quantity > 0);

  const options: QuoteOptions = {
    ...(detergent ? { detergent: true } : {}),
    ...(isSofa ? (sofaInput?.options ?? {}) : {}),
  };
  const key = valid ? JSON.stringify([serviceId, quantity, options, discountCode]) : '';

  useEffect(() => {
    if (!key) {
      setResult(undefined);
      return;
    }
    const [, quoteQuantity, quoteOptions, quoteDiscount] = JSON.parse(key) as [string, number, QuoteOptions, string | undefined];
    let active = true;
    const timer = window.setTimeout(() => {
      requestQuote({ serviceId, quantity: quoteQuantity, options: quoteOptions, discountCode: quoteDiscount }).then(
        quote => { if (active) setResult({ key, quote }); },
        (error: unknown) => { if (active) setResult({ key, error }); },
      );
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [key, serviceId]);

  const unavailable = enabled && rules && (isSofa ? !pricingMode : !model);
  const unsupported = enabled && !isSofa && (model === 'count' || model === 'area');
  return {
    quote: key && result?.key === key ? result.quote : undefined,
    error: enabled ? rulesError ?? (key && result?.key === key ? result.error : undefined) : undefined,
    availabilityMessage: unsupported ? 'برای این خدمت، فرم فعلی جزئیات لازم برای محاسبهٔ قیمت را ندارد.'
      : unavailable ? 'تعرفهٔ این خدمت در دسترس نیست.' : '',
    quantity,
    options,
    pricingMode: isSofa ? pricingMode : null,
  };
}
