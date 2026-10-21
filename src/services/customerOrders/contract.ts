import type { CleanerGender } from '../../types';

/**
 * قرارداد عمومی مشتری برای سفارش — مشترک بین همهٔ حالت‌های راه‌اندازی.
 *
 * فرم‌ها و منطق سایت فقط با همین قرارداد کار می‌کنند. تفاوت بک‌اندها (نام فیلدها، مسیرها،
 * وضعیت‌ها، احراز هویت) **فقط در adapter** همان حالت مدیریت می‌شود، نه با شرط داخل فرم.
 *
 * مرزهای امنیتی این قرارداد:
 *   • فقط سه عمل دارد: پیش‌فاکتور، ثبت درخواست و پیگیری با کد. فهرست سفارش‌ها، تغییر
 *     وضعیت، تخصیص متخصص و هر عمل مدیریتی دیگری در آن **نیست**.
 *   • درخواست ثبت هیچ مبلغی، وضعیتی، وضعیت پرداخت یا متخصص تخصیص‌یافته‌ای ندارد؛ این‌ها را
 *     بک‌اند تعیین می‌کند. مشتری فقط «ورودی‌های انتخاب» را می‌فرستد.
 *   • نمای پیگیری هیچ اطلاعات شخصی (نام، تلفن، نشانی، توضیحات) ندارد.
 */

/** حالت اتصال؛ فقط در تنظیمات راه‌اندازی تعیین می‌شود، نه توسط بازدیدکننده. */
export type OrderBackendMode = 'demo' | 'standalone' | 'coordinated';

/** ورودی پیش‌فاکتور: فقط انتخاب‌ها، بدون هیچ مبلغی. */
export interface QuoteRequest {
  serviceId: string;
  hours: number;
  addonIds: string[];
  hasDetergentPackage: boolean;
  promoCode?: string;
}

export interface QuoteLine {
  id: string;
  title: string;
  amount: number;
}

/** پیش‌فاکتوری که بک‌اندِ همان حالت محاسبه کرده است. */
export interface Quote {
  serviceTitle: string;
  hours: number;
  hourlyRate: number;
  serviceBase: number;
  addonLines: QuoteLine[];
  addonsTotal: number;
  detergentCost: number;
  subtotal: number;
  discountLines: QuoteLine[];
  discountsTotal: number;
  total: number;
  /** `true` یعنی برآورد غیرقطعی است و مبنای دریافت وجه نیست (مثلاً نسخهٔ نمایشی). */
  isProvisional: boolean;
  /** نسخهٔ قیمت‌گذاری بک‌اند؛ برای تشخیص تغییر قیمت میان پیش‌فاکتور و ثبت. */
  pricingVersion?: string;
}

/**
 * درخواست ثبت سفارش از طرف مشتری.
 * عمداً فیلدهای `totalPrice`، `discountApplied`، `status`، `paymentStatus`، `paymentMethod`،
 * `cleanerId`/`cleanerName`/`cleanerPhone` در آن **نیست**.
 */
export interface OrderRequest extends QuoteRequest {
  cleanerGender: CleanerGender;
  /** ترجیح مشتری برای یک متخصص؛ تخصیص محسوب نمی‌شود. */
  requestedCleanerId?: string;
  squareMeters?: number;
  roomsCount?: number;
  date: string;
  timeSlot: string;
  cityName: string;
  district: string;
  address: string;
  unit: string;
  customerName: string;
  /** با ارقام لاتین. */
  customerPhone: string;
  notes?: string;
}

/** فقط فیلدهای مجاز قرارداد؛ هر چیز دیگری (مبلغ، وضعیت، متخصص) دور ریخته می‌شود. */
export const pickOrderRequest = (request: OrderRequest): OrderRequest => ({
  serviceId: request.serviceId,
  hours: request.hours,
  addonIds: [...request.addonIds],
  hasDetergentPackage: request.hasDetergentPackage,
  promoCode: request.promoCode,
  cleanerGender: request.cleanerGender,
  requestedCleanerId: request.requestedCleanerId,
  squareMeters: request.squareMeters,
  roomsCount: request.roomsCount,
  date: request.date,
  timeSlot: request.timeSlot,
  cityName: request.cityName,
  district: request.district,
  address: request.address,
  unit: request.unit,
  customerName: request.customerName,
  customerPhone: request.customerPhone,
  notes: request.notes,
});

/**
 * ⚠️ هنوز ناقص برای حالت‌های عملیاتی: ثبت باید به پیش‌فاکتوری که مشتری دیده و تأیید کرده
 * گره بخورد (بک‌اند اپ موبایل در حالت قیمت سرور `quoteToken` و `confirmedTotal` را الزامی
 * می‌داند). این پیوند همراه با گرفتن فاکتور فرم از `getQuote` در گام بعد اضافه می‌شود؛ نسخهٔ
 * نمایشی به آن نیاز ندارد.
 */
export interface SubmitOrderOptions {
  /**
   * کلید یکتای همین تلاش ثبت. تلاش دوباره برای **همان** درخواست باید همان کلید را بفرستد تا
   * بک‌اند سفارش دوم نسازد؛ کلید یکسان با محتوای متفاوت خطای `conflict` می‌گیرد.
   */
  idempotencyKey: string;
}

/**
 * وضعیت قابل نمایش به مشتری؛ نگاشت وضعیت‌های داخلی هر بک‌اند به این‌ها در adapter است.
 *
 * `cancel_requested` از بک‌اند اپ موبایل آمده است (`CANCEL_REQUESTED`: «درخواست لغو در حال
 * بررسی»)؛ نسخهٔ نمایشی آن را تولید نمی‌کند. این فهرست هنوز نهایی نیست: نگاشت دقیق
 * وضعیت‌های اپ (مثلاً `ACCEPTED`، `CONFIRMED`، `ASSIGNED`) پیش از ساخت adapter هماهنگ باید
 * تأیید شود و نباید با ادغام حدسی معنا از دست برود.
 */
export type PublicOrderStatus =
  | 'new'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancel_requested'
  | 'cancelled';

/** رسید ثبت: فقط آنچه مشتری برای پیگیری لازم دارد. */
export interface OrderReceipt {
  trackingCode: string;
  status: PublicOrderStatus;
  /** ISO 8601 */
  createdAt: string;
  /** مبلغی که خود بک‌اند تعیین کرده است. */
  total: number;
  isProvisional: boolean;
}

/** نمای پیگیری با کد: بدون نام، تلفن، نشانی و توضیحات. */
export interface PublicTrackingView {
  trackingCode: string;
  status: PublicOrderStatus;
  serviceTitle: string;
  date: string;
  timeSlot: string;
  cityName: string;
  /** ISO 8601 */
  createdAt: string;
}

/** قرارداد عمومی مشتری. هر حالت راه‌اندازی یک پیاده‌سازی (adapter) از آن دارد. */
export interface CustomerOrderGateway {
  getQuote(request: QuoteRequest): Promise<Quote>;
  submitOrderRequest(request: OrderRequest, options: SubmitOrderOptions): Promise<OrderReceipt>;
  trackOrder(trackingCode: string): Promise<PublicTrackingView | null>;
}

export type OrderGatewayErrorKind =
  /** ورودی نامعتبر (مثلاً خدمت یا کد تخفیف ناشناخته). */
  | 'validation'
  /** قیمت میان پیش‌فاکتور و ثبت تغییر کرده است. */
  | 'price_changed'
  /** کلید یکسان با محتوای متفاوت. */
  | 'conflict'
  | 'rate_limited'
  /**
   * درخواست **قطعاً** پردازش نشده است؛ مثلاً مرورگر پیش از ارسال آفلاین بود یا بک‌اند صریحاً
   * اعلام کرد چیزی ثبت نکرده است. فقط وقتی به‌کار می‌رود که adapter از ثبت‌نشدن مطمئن باشد.
   */
  | 'unavailable'
  /**
   * نتیجهٔ ثبت **معلوم نیست**: درخواست ممکن است به بک‌اند رسیده و ثبت شده باشد ولی پاسخ به
   * مرورگر نرسیده باشد (قطع ارتباط پس از ارسال، پایان مهلت، پاسخ ناقص یا خطای میانی).
   * adapter در هر تردیدی همین نوع را برمی‌گرداند، نه `unavailable`. لایهٔ اتصال در این حالت
   * همان درخواست و همان کلید را نگه می‌دارد تا نتیجه روشن شود.
   */
  | 'outcome_unknown'
  /** اتصال این حالت هنوز پیاده‌سازی نشده یا تنظیمات راه‌اندازی نامعتبر است. */
  | 'not_implemented'
  /** فقط نسخهٔ نمایشی: ذخیره در حافظهٔ همین مرورگر ناموفق بود. */
  | 'local_storage';

export class OrderGatewayError extends Error {
  readonly kind: OrderGatewayErrorKind;

  constructor(kind: OrderGatewayErrorKind, message: string) {
    super(message);
    this.name = 'OrderGatewayError';
    this.kind = kind;
  }
}

export const isOrderGatewayError = (error: unknown): error is OrderGatewayError =>
  error instanceof OrderGatewayError;

/**
 * آیا خطای ثبت ممکن است با ثبت موفق در بک‌اند همراه بوده باشد؟
 * هر خطایی که از قرارداد نیامده (مثلاً استثنای پیش‌بینی‌نشده در adapter) هم نامشخص حساب
 * می‌شود؛ ثبت‌نشدن فقط با خطای قطعیِ صریح اعلام می‌شود.
 */
export const isUncertainSubmitOutcome = (error: unknown): boolean =>
  !isOrderGatewayError(error) || error.kind === 'outcome_unknown';
