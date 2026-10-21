import type { OrderBackendMode } from '../services/customerOrders/contract';

/**
 * انتخاب حالت اتصال سفارش‌ها — **فقط در تنظیمات راه‌اندازی**.
 *
 * مقدار از متغیر `VITE_ORDER_BACKEND` در زمان build خوانده می‌شود و در کد مرورگر ثابت است.
 * بازدیدکننده هیچ راهی (پارامتر نشانی، localStorage، کوکی) برای تغییر آن ندارد.
 *
 *   • `demo` (پیش‌فرض، وقتی متغیر تنظیم نشده): نسخهٔ نمایشی فعلی؛ فقط حافظهٔ همین مرورگر.
 *     این حالت «بک‌اند مستقل» نیست.
 *   • `standalone`: بک‌اند و پنل مدیر خود سایت. **هنوز پیاده‌سازی نشده است.**
 *   • `coordinated`: بک‌اند مشترک با اپ موبایل. **هنوز پیاده‌سازی نشده است.**
 *
 * مقدار ناشناخته خطای تنظیمات است: هیچ سفارشی ثبت نمی‌شود و به نسخهٔ نمایشی برنمی‌گردد.
 */
export const ORDER_BACKEND_MODES: readonly OrderBackendMode[] = ['demo', 'standalone', 'coordinated'];

/** `null` یعنی مقدار تنظیم‌شده نامعتبر است. */
export const resolveOrderBackendMode = (raw: string | undefined): OrderBackendMode | null => {
  const value = (raw ?? '').trim();
  if (value === '') return 'demo';
  return (ORDER_BACKEND_MODES as readonly string[]).includes(value) ? (value as OrderBackendMode) : null;
};

export const CONFIGURED_ORDER_BACKEND_VALUE: string | undefined = import.meta.env.VITE_ORDER_BACKEND;

export const ORDER_BACKEND_MODE: OrderBackendMode | null = resolveOrderBackendMode(
  CONFIGURED_ORDER_BACKEND_VALUE,
);
