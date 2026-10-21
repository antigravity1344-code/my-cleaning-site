import type { BookingOrder, OrderStatus, ServiceType } from '../../types';
import { CLEANERS_LIST } from '../../data/mockData';
import { calculatePrice } from '../../pricing/pricingEngine';
import { buildDemoOrderPayload } from '../demoOrder';
import type { IOrderService } from '../orderService.types';
import {
  OrderGatewayError,
  pickOrderRequest,
  type CustomerOrderGateway,
  type OrderReceipt,
  type OrderRequest,
  type PublicOrderStatus,
  type PublicTrackingView,
  type Quote,
  type QuoteRequest,
  type SubmitOrderOptions,
} from './contract';

/**
 * adapter نسخهٔ نمایشی.
 *
 * این adapter **بک‌اند مستقل نیست**: هیچ سفارشی به کسب‌وکار نمی‌رسد و داده فقط (به‌صورت
 * ماسک‌شده) در حافظهٔ همین مرورگر می‌ماند. قیمت با موتور نمایشی و کدهای تخفیف نمونه حساب
 * می‌شود و همیشه «غیرقطعی» علامت می‌خورد.
 *
 * رفتار ذخیره‌سازی همان `DemoLocalOrderService` قبلی است؛ فقط ورودی آن دیگر از فرم نمی‌آید:
 * این adapter مبلغ، وضعیت و روش پرداخت را خودش تعیین می‌کند و هر فیلد اضافه‌ای در درخواست را
 * نادیده می‌گیرد.
 */

/** امکانات **فقط نمایشی** که در قرارداد عمومی مشتری نیستند. در حالت‌های عملیاتی وجود ندارند. */
export interface DemoOrderLedger {
  /** سفارش‌های ماسک‌شدهٔ همین مرورگر. */
  listLocalOrders(): Promise<BookingOrder[]>;
  /** نسخهٔ کامل سفارشی که در همین نشست ساخته شده (فقط در حافظه، روی دیسک ذخیره نمی‌شود). */
  getSessionRecord(trackingCode: string): BookingOrder | undefined;
  submitOrderRating(orderId: string, rating: number): Promise<BookingOrder>;
  cancelOrder(orderId: string): Promise<BookingOrder>;
}

const DEMO_STATUS_TO_PUBLIC: Record<OrderStatus, PublicOrderStatus> = {
  pending: 'new',
  assigned: 'confirmed',
  on_the_way: 'in_progress',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
};

const toQuote = (request: QuoteRequest): Quote => {
  const breakdown = calculatePrice({
    serviceId: request.serviceId as ServiceType,
    hours: request.hours,
    addonIds: request.addonIds,
    hasDetergentPackage: request.hasDetergentPackage,
    promoCode: request.promoCode,
  });
  return {
    serviceTitle: breakdown.serviceTitle,
    hours: breakdown.hours,
    hourlyRate: breakdown.hourlyRate,
    serviceBase: breakdown.serviceBase,
    addonLines: breakdown.addonLines,
    addonsTotal: breakdown.addonsTotal,
    detergentCost: breakdown.detergentCost,
    subtotal: breakdown.subtotal,
    discountLines: breakdown.discountLines,
    discountsTotal: breakdown.discountsTotal,
    total: breakdown.total,
    isProvisional: true,
  };
};

const toReceipt = (record: BookingOrder): OrderReceipt => ({
  trackingCode: record.trackingCode,
  status: DEMO_STATUS_TO_PUBLIC[record.status] ?? 'new',
  createdAt: record.createdAt,
  total: record.totalPrice,
  isProvisional: true,
});

const toTrackingView = (record: BookingOrder): PublicTrackingView => ({
  trackingCode: record.trackingCode,
  status: DEMO_STATUS_TO_PUBLIC[record.status] ?? 'new',
  serviceTitle: record.serviceTitle,
  date: record.date,
  timeSlot: record.timeSlot,
  cityName: record.cityName,
  createdAt: record.createdAt,
});

export interface DemoOrderBackend {
  gateway: CustomerOrderGateway;
  ledger: DemoOrderLedger;
}

export const createDemoOrderBackend = (store: IOrderService): DemoOrderBackend => {
  /**
   * کلید تکرار ← همان تلاش (فقط در حافظهٔ همین صفحه).
   *
   * کلید و اثرانگشت درخواست **پیش از اولین انتظار** ثبت می‌شوند و خودِ عملیات در جریان
   * (Promise) نگه داشته می‌شود؛ پس درخواست هم‌زمانی که همان کلید را بیاورد:
   *   • با همان محتوا ← نتیجهٔ همان عملیات را می‌گیرد (سفارش دوم ساخته نمی‌شود)؛
   *   • با محتوای دیگر ← `conflict` می‌گیرد.
   * اگر ذخیره قطعاً شکست بخورد، کلید آزاد می‌شود تا تلاش دوبارهٔ معتبر ممکن بماند.
   */
  const submissions = new Map<string, { fingerprint: string; result: Promise<OrderReceipt> }>();
  /** نسخهٔ کامل سفارش‌های همین نشست؛ روی دیسک فقط نسخهٔ ماسک‌شده می‌ماند. */
  const sessionRecords = new Map<string, BookingOrder>();

  const gateway: CustomerOrderGateway = {
    async getQuote(request) {
      return toQuote(request);
    },

    submitOrderRequest(rawRequest, options: SubmitOrderOptions) {
      const request = pickOrderRequest(rawRequest);
      const fingerprint = JSON.stringify(request);
      const key = options.idempotencyKey;
      const previous = submissions.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          return Promise.reject(
            new OrderGatewayError('conflict', 'این درخواست قبلاً با اطلاعات دیگری ثبت شده است.'),
          );
        }
        return previous.result;
      }

      // ثبت هم‌زمان، پیش از هر انتظاری: درخواست بعدی با همین کلید همین Promise را می‌بیند.
      const result = createRecord(request);
      submissions.set(key, { fingerprint, result });
      result.catch(() => {
        // شکست قطعی: هیچ سفارشی ساخته نشده، پس کلید آزاد می‌شود تا تلاش دوباره ممکن باشد.
        if (submissions.get(key)?.result === result) submissions.delete(key);
      });
      return result;
    },

    async trackOrder(trackingCode) {
      const record = await store.getOrderByTrackingCode(trackingCode);
      return record ? toTrackingView(record) : null;
    },
  };

  /** ساخت و ذخیرهٔ رکورد نمایشی برای درخواستی که از قبل به فیلدهای مجاز محدود شده است. */
  async function createRecord(request: OrderRequest): Promise<OrderReceipt> {
    const quote = toQuote(request);
    const requestedCleaner = CLEANERS_LIST.find((cleaner) => cleaner.id === request.requestedCleanerId);
    const payload = buildDemoOrderPayload({
      serviceId: request.serviceId as ServiceType,
      serviceTitle: quote.serviceTitle,
      cleanerGender: request.cleanerGender,
      hours: request.hours,
      squareMeters: request.squareMeters,
      roomsCount: request.roomsCount,
      selectedAddons: request.addonIds,
      hasDetergentPackage: request.hasDetergentPackage,
      date: request.date,
      timeSlot: request.timeSlot,
      cityName: request.cityName,
      district: request.district,
      address: request.address,
      unit: request.unit,
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      notes: request.notes,
      totalPrice: quote.total,
      discountApplied: quote.discountsTotal,
      requestedCleanerId: requestedCleaner?.id,
      requestedCleanerName: requestedCleaner?.name,
      // درگاه آنلاین وجود ندارد؛ روش پرداخت را adapter تعیین می‌کند، نه مرورگرِ مشتری.
      paymentMethod: 'cash_on_site',
    });

    let record: BookingOrder;
    try {
      record = await store.createOrder(payload);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'ذخیره‌سازی محلی ناموفق بود.';
      throw new OrderGatewayError('local_storage', message);
    }

    sessionRecords.set(record.trackingCode, record);
    return toReceipt(record);
  }

  const ledger: DemoOrderLedger = {
    listLocalOrders: () => store.getOrders(),
    getSessionRecord: (trackingCode) => sessionRecords.get(trackingCode),
    submitOrderRating: (orderId, rating) => store.submitOrderRating(orderId, rating),
    cancelOrder: (orderId) => store.cancelOrder(orderId),
  };

  return { gateway, ledger };
};
