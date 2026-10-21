import { OrderGatewayError, type CustomerOrderGateway, type OrderBackendMode } from './contract';

/**
 * adapter حالت‌هایی که هنوز پیاده‌سازی نشده‌اند (`standalone`، `coordinated`) یا تنظیماتشان
 * نامعتبر است.
 *
 * هر عمل با خطای `not_implemented` رد می‌شود. این adapter عمداً **هیچ** راه بازگشتی به
 * ذخیرهٔ نمایشی ندارد: نه localStorage را می‌خواند و نه در آن می‌نویسد، تا هیچ‌وقت موفقیت
 * کاذب نشان داده نشود. وجود این فایل به‌معنای آمادگی اتصال عملیاتی نیست.
 */
export type UnavailableReason = Exclude<OrderBackendMode, 'demo'> | 'misconfigured';

const REASON_TEXT: Record<UnavailableReason, string> = {
  standalone: 'اتصال به بک‌اند مستقل سایت هنوز ساخته نشده است.',
  coordinated: 'اتصال به بک‌اند مشترک با اپ موبایل هنوز ساخته نشده است.',
  misconfigured: 'تنظیمات اتصال سفارش‌ها نامعتبر است.',
};

export const unavailableMessage = (reason: UnavailableReason): string =>
  `${REASON_TEXT[reason]} درخواستی ثبت نشد.`;

export const createUnavailableGateway = (reason: UnavailableReason): CustomerOrderGateway => {
  const reject = async (): Promise<never> => {
    throw new OrderGatewayError('not_implemented', unavailableMessage(reason));
  };
  return {
    getQuote: reject,
    submitOrderRequest: reject,
    trackOrder: reject,
  };
};
