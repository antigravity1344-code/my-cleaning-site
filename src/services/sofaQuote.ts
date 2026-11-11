export const SOFA_PAKSHO_SERVICE_ID = 'sofa_carpet_washing';
export const SOFA_MAX_MATTRESSES = 20;

export type SofaPricingMode = 'units' | 'mattress_seat';
export type SofaSeat = '7' | '9';
export interface SofaFormValues {
  mattresses: number;
  seatSize: SofaSeat;
}
export interface SofaQuoteInput {
  quantity: number;
  options: Record<string, string>;
}

/** تبدیل فرم مبل‌شویی به ورودی نقل‌قول سرور بر اساس حالت قیمت‌گذاری تعریف‌شده در پنل. null یعنی ورودی ناقص یا خدمت خاموش است. */
export function sofaQuoteInput(mode: SofaPricingMode | null | undefined, form: SofaFormValues): SofaQuoteInput | null {
  const count = form.mattresses;
  if (!Number.isSafeInteger(count) || count < 1 || count > SOFA_MAX_MATTRESSES) return null;
  if (mode === 'units') return { quantity: count, options: {} };
  if (mode === 'mattress_seat' && (form.seatSize === '7' || form.seatSize === '9')) {
    return { quantity: count, options: { seatSize: form.seatSize } };
  }
  return null;
}
