import { BookingOrder } from '../types';
import { CreateOrderDTO, IOrderService } from './orderService.types';

/**
 * پیاده‌سازی عملیاتی سرویس سفارش — سند عملیاتی، بخش ۱۵ (PR#5).
 *
 * ⚠️ وضعیت فعلی: این فایل ساخته و آزموده شده، اما به‌صورت پیش‌فرض در سایت سوار
 * (wire) **نیست** — `orderService.ts` همچنان `DemoLocalOrderService` را
 * صادر می‌کند و رفتار سایت فعلی تغییری نکرده. دلیل: سوار کردن این سرویس در
 * `OrderTrackerModal` یک تصمیم طراحی واقعی لازم دارد، نه فقط اتصال مکانیکی:
 *   • `OrderTrackerModal` یک نوار پیشرفت ۵مرحله‌ای نمایشی دارد (ثبت → تخصیص →
 *     در مسیر → در حال نظافت → پایان) که مخصوص گردش‌کار آزمایشی است. سرور
 *     عملیاتی واقعی فقط ۴ وضعیت تخت دارد (new/confirmed/completed/cancelled؛
 *     بخش ۳) و هیچ مرحلهٔ «اعزام» یا «در حال نظافت» را تولید نمی‌کند — نگاشتن
 *     وضعیت واقعی به آن نوار پیشرفت، مراحلی را نشان می‌دهد که اصلاً رخ
 *     نداده‌اند.
 *   • `GET /api/track/:code` (پیگیری عمومی) عمداً نام، آدرس، تلفن و مبلغ را
 *     برنمی‌گرداند (بخش ۷). `getOrderByTrackingCode` اینجا این محدودیت را با
 *     `isPublicSummary: true` علامت می‌زند (types.ts)، اما خودِ
 *     `OrderTrackerModal` هنوز این پرچم را نمی‌خواند و بخش‌های مالی/تماس را
 *     همیشه نمایش می‌دهد.
 * سوار کردن این سرویس باید همراه با به‌روزرسانی `OrderTrackerModal` برای این
 * دو نکته باشد؛ تا آن زمان، این فایل فقط آمادهٔ استفاده است.
 */

const API_BASE = '/api';

class HttpOrderServiceError extends Error {}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  // نکته: `...options` باید قبل از `headers` ادغام شود؛ وگرنه options.headers
  // کل شیء headers (و content-type پیش‌فرض) را می‌پوشاند — همان باگی که در
  // پنل مدیر (src/admin/adminApi.ts) با آزمون سرتاسری پیدا و رفع شد.
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    let message = 'خطایی در ارتباط با سرور رخ داد.';
    try {
      const body = await res.json();
      if (typeof body?.message === 'string') message = body.message;
    } catch {
      // بدنهٔ خطا JSON نبود؛ پیام پیش‌فرض باقی می‌ماند.
    }
    throw new HttpOrderServiceError(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

interface ServerOrderResponse {
  trackingCode: string;
  status: string;
  serviceId: string;
  serviceTitle: string;
  hours: number;
  total: number;
  createdAt: string;
}

interface ServerTrackResponse {
  serviceTitle: string;
  date: string | null;
  timeSlot: string | null;
  cityName: string | null;
  status: string;
  statusUpdatedAt: string;
}

/** تولید کلید idempotency — سند عملیاتی بخش ۵: UUID v4 به‌ازای هر تلاش ثبت. */
const generateIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

class HttpOrderService implements IOrderService {
  /**
   * بدون حساب مشتری در نسخهٔ اول (بخش ۱۱)، «سفارش‌های من» مفهومی ندارد —
   * تنها راه دیدن یک سفارش، کد پیگیری آن است.
   */
  public async getOrders(): Promise<BookingOrder[]> {
    return [];
  }

  /**
   * شناسهٔ داخلی سفارش (UUID پایگاه‌داده) هرگز از سرور عمومی قابل‌دسترس
   * نیست — فقط پنل مدیر (با نشست احرازهویت‌شده) آن را می‌بیند. اینجا همیشه
   * null برمی‌گرداند؛ مسیر درست، کد پیگیری است.
   */
  public async getOrderById(): Promise<BookingOrder | null> {
    return null;
  }

  public async getOrderByTrackingCode(trackingCode: string): Promise<BookingOrder | null> {
    const code = trackingCode.trim();
    if (!code) return null;

    let result: ServerTrackResponse;
    try {
      result = await request<ServerTrackResponse>(`/track/${encodeURIComponent(code)}`);
    } catch {
      // سرور کد ناموجود و کد نامعتبر را یکسان (۴۰۴) پاسخ می‌دهد (بخش ۷)؛
      // اینجا هم تفاوتی بین آن دو گذاشته نمی‌شود.
      return null;
    }

    // فیلدهای مالی/تماس در پاسخ عمومی پیگیری اصلاً وجود ندارند (بخش ۷). مقادیر
    // زیر فقط جای‌نگه‌دارِ نوع BookingOrder‌اند؛ `isPublicSummary: true` به
    // مصرف‌کننده می‌گوید آن‌ها را نمایش ندهد، نه این‌که «صفر» یا «خالی» واقعی‌اند.
    return {
      id: code,
      trackingCode: code,
      // createdAt واقعی در پاسخ عمومی نیست؛ تنها زمان آخرین تغییر وضعیت در دسترس است.
      createdAt: result.statusUpdatedAt,
      status: result.status as BookingOrder['status'],
      isPublicSummary: true,
      recordType: 'demo', // TODO(PR#5-ادامه): یک RecordType عملیاتی مجزا لازم دارد؛ فعلاً این سرویس سوار نیست.
      paymentStatus: 'unpaid',
      serviceId: '' as BookingOrder['serviceId'],
      serviceTitle: result.serviceTitle,
      cleanerGender: 'no-pref',
      hours: 0,
      selectedAddons: [],
      hasDetergentPackage: false,
      date: result.date ?? '',
      timeSlot: result.timeSlot ?? '',
      cityName: result.cityName ?? '',
      district: '',
      address: '',
      unit: '',
      customerName: '',
      customerPhone: '',
      totalPrice: 0,
      discountApplied: 0,
      paymentMethod: 'cash_on_site',
    };
  }

  public async createOrder(orderData: CreateOrderDTO): Promise<BookingOrder> {
    const payload = {
      serviceId: orderData.serviceId,
      hours: orderData.hours,
      addonIds: orderData.selectedAddons,
      hasDetergentPackage: orderData.hasDetergentPackage,
      // توجه: کد تخفیف در CreateOrderDTO نیست (مبلغ تخفیف از پیش روی مرورگر
      // حساب شده)؛ این حفره شناخته‌شده است — سوار کردن این سرویس باید همراه
      // با عبور دادن خودِ کد تخفیف (نه فقط مبلغش) تا اینجا انجام شود، تا سرور
      // بتواند دوباره محاسبه و اعتبارسنجی کند (بخش ۴).
      date: orderData.date,
      timeSlot: orderData.timeSlot,
      cityName: orderData.cityName,
      district: orderData.district,
      address: orderData.address,
      unit: orderData.unit,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      notes: orderData.notes,
    };

    const result = await request<ServerOrderResponse>('/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
      body: JSON.stringify(payload),
    });

    // برخلاف getOrderByTrackingCode، همین الان همهٔ فیلدها را خودمان فرستادیم؛
    // پس می‌توانیم یک BookingOrder کامل و صادق برگردانیم (نه یک نمای عمومی محدود).
    return {
      id: result.trackingCode,
      trackingCode: result.trackingCode,
      createdAt: result.createdAt,
      status: result.status as BookingOrder['status'],
      recordType: 'demo', // TODO(PR#5-ادامه): همان نکتهٔ بالا.
      paymentStatus: 'unpaid',
      serviceId: orderData.serviceId,
      serviceTitle: result.serviceTitle,
      cleanerGender: orderData.cleanerGender,
      requestedCleanerId: orderData.requestedCleanerId,
      requestedCleanerName: orderData.requestedCleanerName,
      hours: result.hours,
      squareMeters: orderData.squareMeters,
      roomsCount: orderData.roomsCount,
      selectedAddons: orderData.selectedAddons,
      hasDetergentPackage: orderData.hasDetergentPackage,
      date: orderData.date,
      timeSlot: orderData.timeSlot,
      cityName: orderData.cityName,
      district: orderData.district,
      address: orderData.address,
      unit: orderData.unit,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      notes: orderData.notes,
      // مبلغ سرور معتبر است (دوباره‌محاسبه‌شده)، نه مبلغ محاسبه‌شدهٔ مرورگر.
      totalPrice: result.total,
      discountApplied: orderData.discountApplied,
      paymentMethod: orderData.paymentMethod,
    };
  }

  /** هیچ مسیر سرور برای امتیاز مشتری وجود ندارد (خارج از دامنهٔ سند عملیاتی v1). */
  public async submitOrderRating(): Promise<BookingOrder> {
    throw new HttpOrderServiceError('ثبت امتیاز هنوز در نسخهٔ عملیاتی پشتیبانی نمی‌شود.');
  }

  /**
   * بخش ۷: «لغو ... در نسخهٔ اول نیست؛ لغو با تماس با کسب‌وکار انجام می‌شود.»
   * این متد عمداً موفقیت کاذب نمی‌دهد.
   */
  public async cancelOrder(): Promise<BookingOrder> {
    throw new HttpOrderServiceError(
      'لغو آنلاین در این نسخه وجود ندارد؛ برای لغو با کسب‌وکار تماس بگیرید.'
    );
  }
}

export const httpOrderService: IOrderService = new HttpOrderService();
export { HttpOrderServiceError };
