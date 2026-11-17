/**
 * قابلیت‌ها و وضعیت تأیید ادعاهای وب‌سایت پاک‌شو.
 *
 * اگر `VITE_PAKSHO_API_BASE` در زمان ساخت تنظیم باشد، سایت به سرور پاکشو وصل است
 * و حالت نمایشی خاموش می‌شود. بدون آن، رفتار نمایشی محلی باقی می‌ماند.
 *
 * این فایل تنها محل تصمیم‌گیری درباره این قابلیت‌هاست؛ کامپوننت‌ها باید وضعیت را
 * از این‌جا بخوانند تا خاموش/روشن‌کردن آن‌ها در یک نقطه ممکن باشد.
 */

function pakshoApiConfigured(): boolean {
  return String(import.meta.env.VITE_PAKSHO_API_BASE ?? '').trim() !== '';
}

/** سایت در حالت نمایشی است مگر سرور پاکشو در ساخت تنظیم شده باشد. */
export const DEMO_MODE = !pakshoApiConfigured();

/**
 * ادعاهای اعتباری (بیمه حوادث، بیمه مسئولیت، نماد اعتماد الکترونیکی، عضویت اتحادیه،
 * احراز هویت و عدم سوءپیشینه متخصصین، آمار مشتریان، گارانتی رضایت) تا زمانی که
 * مستندات معتبر در مخزن/مدارک شرکت وجود داشته باشد باید غیرفعال بمانند.
 */
export const VERIFIED_TRUST_CLAIMS_AVAILABLE = false;

/** اتصال به درگاه پرداخت بانکی هنوز برقرار نشده است. */
export const ONLINE_PAYMENT_AVAILABLE = false;

/** کد ورود پیامکی از مسیر سرور پاکشو می‌رود؛ وقتی سایت به سرور وصل باشد فعال است. */
export const NOTIFICATIONS_AVAILABLE = !DEMO_MODE;

/** تخصیص واقعی متخصص روی سایت نیست؛ از پنل و اپ پاکشو انجام می‌شود. */
export const CLEANER_ASSIGNMENT_AVAILABLE = false;

/** نمایش شماره تماس متخصص فقط با اطلاعات تأییدشده سرور مجاز است. */
export const CLEANER_CONTACT_AVAILABLE = false;

/** مبلغ سفارش وقتی از سرور پاکشو می‌آید قطعی حساب می‌شود. */
export const SERVER_SIDE_PRICING_AVAILABLE = !DEMO_MODE;

const DEMO_COPY_TEXT = {
  badge: 'نسخه آزمایشی',

  banner:
    'نسخه آزمایشی: این وب‌سایت نمایشی است. درخواست‌ها ثبت واقعی نمی‌شوند، ' +
    'متخصصی اعزام نمی‌شود، پیامکی ارسال نمی‌شود و پرداخت آنلاین فعال نیست.',

  orderFlowNotice:
    'این فرم یک نمایش آزمایشی است و درخواست شما به تیم عملیات پاک‌شو ارسال نمی‌شود.',

  successTitle: 'درخواست شما در حالت آزمایشی ثبت شد',

  successDescription:
    'این نسخه هیچ اتصالی به سرور پاک‌شو ندارد؛ اطلاعات فقط در همین مرورگر (و بدون ' +
    'اطلاعات تماس کامل) نگه‌داری می‌شود و هیچ متخصصی تخصیص داده نمی‌شود.',

  paymentOnlineDisabled:
    'در نسخه آزمایشی غیرفعال است — پرداخت آنلاین پس از اتصال به سرور و درگاه بانکی فعال می‌شود.',

  paymentCashNotice:
    'در نسخه آزمایشی هیچ وجهی دریافت نمی‌شود؛ این گزینه فقط برای نمایش جریان سفارش است.',

  noCleanerAssignment:
    'در نسخه آزمایشی متخصصی تخصیص داده نمی‌شود و شماره تماس متخصص نمایش داده نمی‌شود.',

  notificationsNotice:
    'سرویس پیامک/ایمیل پاک‌شو هنوز به این سایت متصل نشده است؛ در نسخه آزمایشی هیچ پیامکی ارسال نمی‌شود.',

  sampleDataBadge: 'داده نمونه (نمایشی)',

  sampleProfileBadge: 'پروفایل نمونه',

  provisionalPriceLabel: 'مبلغ پیشنهادی (آزمایشی)',

  provisionalPriceNote:
    'مبلغ نهایی پس از اتصال به سرور پاک‌شو محاسبه و تأیید می‌شود؛ مبلغ نمایش‌داده‌شده ' +
    'مبنای دریافت وجه نیست.',
} as const;

const LIVE_COPY_TEXT = {
  badge: '',

  banner: '',

  orderFlowNotice: '',

  successTitle: 'درخواست شما ثبت شد',

  successDescription:
    'کد پیگیری را نگه دارید. هماهنگی نهایی تلفنی انجام می‌شود و تخصیص متخصص از پنل پاکشو است.',

  paymentOnlineDisabled: 'پرداخت اینترنتی هنوز فعال نیست.',

  paymentCashNotice: 'مبلغ را پس از انجام کار در محل به متخصص بپردازید.',

  noCleanerAssignment:
    'تخصیص متخصص از پنل پاکشو انجام می‌شود؛ انتخاب روی سایت فقط درخواست شماست.',

  notificationsNotice: 'کد ورود با پیامک ارسال می‌شود.',

  sampleDataBadge: 'نمونه',

  sampleProfileBadge: 'نمونه',

  provisionalPriceLabel: 'مبلغ',

  provisionalPriceNote: 'این مبلغ را سرور پاکشو حساب می‌کند.',
} as const;

export const DEMO_COPY = DEMO_MODE ? DEMO_COPY_TEXT : LIVE_COPY_TEXT;
