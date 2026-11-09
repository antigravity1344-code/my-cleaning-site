/**
 * نگاشت وضعیت‌ها — سند عملیاتی، بخش ۳. این فایل یک کپی نمایشی (فقط برای
 * نمایش برچسب فارسی و فعال/غیرفعال کردن دکمه‌ها) از همان جدولی است که
 * server/standaloneBackend.js (ALLOWED_STATUS_TRANSITIONS) اجرا می‌کند؛
 * تصمیم نهایی همیشه با سرور است — این فقط UI را منطقی نگه می‌دارد.
 */
export const STATUS_LABELS: Record<string, string> = {
  new: 'ثبت شد؛ در انتظار تماس',
  confirmed: 'تأیید شد',
  completed: 'انجام شد',
  cancelled: 'لغو شد',
};

export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const STATUS_BADGE_CLASS: Record<string, string> = {
  new: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};
