import type { CleanerGender, OrderStatus, ServiceType } from '../types';
import type { CreateOrderDTO } from './orderService.types';
import { CLEANER_ASSIGNMENT_AVAILABLE, ONLINE_PAYMENT_AVAILABLE } from '../config/capabilities';

/**
 * ساخت سفارش آزمایشی.
 *
 * این ماژول تابع خالص و قابل آزمون برای تبدیل ورودی‌های فرم رزرو به داده سفارش است تا
 * اطمینان حاصل شود در نسخه آزمایشی:
 *   • هیچ شماره تماس ساختگی برای متخصص تولید نمی‌شود،
 *   • هیچ تخصیص متخصص یا وضعیت عملیاتی «انجام‌شده» جعل نمی‌شود،
 *   • پرداخت آنلاین (که درگاه آن وجود ندارد) انتخاب نمی‌شود،
 *   • وضعیت سفارش فقط «در انتظار بررسی» است.
 */

/** وضعیت آزمایشی سفارش: هیچ ادعایی درباره تخصیص متخصص نمی‌شود. */
export const DEMO_ORDER_STATUS: OrderStatus = 'pending';

/** پیشوند کد پیگیری آزمایشی تا هیچ‌گاه با کد عملیاتی سرور اشتباه نشود. */
export const DEMO_TRACKING_PREFIX = 'DEMO-';

export interface DemoOrderFormInput {
  serviceId: ServiceType;
  serviceTitle: string;
  cleanerGender: CleanerGender;
  hours: number;
  squareMeters?: number;
  roomsCount?: number;
  selectedAddons: string[];
  hasDetergentPackage: boolean;
  date: string;
  timeSlot: string;
  cityName: string;
  district: string;
  address: string;
  unit: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
  totalPrice: number;
  discountApplied: number;
  /** انتخاب نمایشی کاربر از فهرست نمونه — به‌معنای تخصیص متخصص نیست. */
  requestedCleanerId?: string;
  requestedCleanerName?: string;
  /**
   * روش پرداخت انتخاب‌شده توسط کاربر در فرم رزرو. تا زمانی که
   * ONLINE_PAYMENT_AVAILABLE=false است، این مقدار همیشه باید
   * 'cash_on_site' باشد (در ادامه هم اعتبارسنجی می‌شود)، اما خودِ انتخاب
   * باید از فرم بیاید، نه این‌که این ماژول مستقل تصمیم بگیرد.
   */
  paymentMethod: 'online' | 'cash_on_site';
}

/**
 * تولید کد پیگیری آزمایشی با آنتروپی کافی و بدون تکرار در فهرست کدهای موجود.
 * (کد عملیاتی نهایی باید سمت سرور و با تضمین یکتایی ساخته شود.)
 */
export const generateDemoTrackingCode = (
  existingCodes: readonly string[] = [],
  randomBytes: (length: number) => Uint8Array = defaultRandomBytes,
): string => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = randomBytes(6);
    const body = Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const code = `${DEMO_TRACKING_PREFIX}${body}`;
    if (!existingCodes.includes(code)) return code;
  }
  // مسیر پشتیبان قطعی؛ تنها در صورت تکرار تصادفی ۲۰ باره رخ می‌دهد.
  return `${DEMO_TRACKING_PREFIX}${Date.now().toString(36).toUpperCase()}`;
};

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }
  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * ساخت داده سفارش آزمایشی.
 * تابع خالص است و هیچ وابستگی به مرورگر یا شبکه ندارد.
 */
export const buildDemoOrderPayload = (input: DemoOrderFormInput): CreateOrderDTO => {
  if (CLEANER_ASSIGNMENT_AVAILABLE) {
    throw new Error('در نسخه آزمایشی تخصیص متخصص پشتیبانی نمی‌شود.');
  }

  return {
    serviceId: input.serviceId,
    serviceTitle: input.serviceTitle,
    cleanerGender: input.cleanerGender,
    // هیچ متخصصی تخصیص داده نمی‌شود و هیچ شماره تماسی تولید نمی‌شود.
    cleanerId: undefined,
    cleanerName: undefined,
    cleanerPhone: undefined,
    cleanerAvatar: undefined,
    requestedCleanerId: input.requestedCleanerId,
    requestedCleanerName: input.requestedCleanerName,
    hours: input.hours,
    squareMeters: input.squareMeters,
    roomsCount: input.roomsCount,
    selectedAddons: input.selectedAddons,
    hasDetergentPackage: input.hasDetergentPackage,
    date: input.date,
    timeSlot: input.timeSlot,
    cityName: input.cityName,
    district: input.district,
    address: input.address,
    unit: input.unit,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    notes: input.notes,
    totalPrice: input.totalPrice,
    discountApplied: input.discountApplied,
    // روش پرداخت از انتخاب واقعی کاربر در فرم می‌آید (و دیگر مستقل از آن
    // تصمیم‌گیری نمی‌شود). با این حال، تا زمانی که درگاه واقعی وصل نشده،
    // به‌عنوان یک محافظ، هر مقداری غیر از 'cash_on_site' نادیده گرفته
    // می‌شود — چون رابط کاربری فعلی هم اصلاً اجازه انتخاب «پرداخت آنلاین»
    // را نمی‌دهد.
    paymentMethod: ONLINE_PAYMENT_AVAILABLE ? input.paymentMethod : 'cash_on_site',
    paymentStatus: 'unpaid',
    status: DEMO_ORDER_STATUS,
  };
};
