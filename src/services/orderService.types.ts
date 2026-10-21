import { BookingOrder, OrderStatus, PaymentStatus, RecordType } from '../types';

/**
 * شکل رکورد ذخیرهٔ **نسخهٔ نمایشی** در حافظهٔ مرورگر.
 *
 * ⚠️ این نوع قرارداد API نیست و نباید از مرورگرِ مشتری به سرور فرستاده شود: مبلغ، تخفیف،
 * وضعیت، وضعیت پرداخت و فیلدهای متخصص در آن هست. فرم‌ها از قرارداد عمومی مشتری
 * (`src/services/customerOrders/contract.ts` ← `OrderRequest`) استفاده می‌کنند و فقط adapter
 * نمایشی این رکورد را می‌سازد.
 */
export interface CreateOrderDTO {
  serviceId: BookingOrder['serviceId'];
  serviceTitle: BookingOrder['serviceTitle'];
  cleanerGender: BookingOrder['cleanerGender'];
  /** فقط در صورت تخصیص تأییدشده توسط سرور مقدار می‌گیرد. */
  cleanerId?: string;
  cleanerName?: string;
  cleanerPhone?: string;
  cleanerAvatar?: string;
  /** انتخاب نمایشی کاربر از فهرست نمونه (تخصیص محسوب نمی‌شود). */
  requestedCleanerId?: string;
  requestedCleanerName?: string;
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
  paymentMethod: 'online' | 'cash_on_site';
  paymentStatus?: PaymentStatus;
  status?: OrderStatus;
  recordType?: RecordType;
}

/**
 * ثبت امتیاز مشتری.
 * توجه: متن آزاد بازخورد عمداً در این قرارداد وجود ندارد؛ در نسخه نمایشی
 * متن آزاد ذخیره نمی‌شود تا از باقی‌ماندن ناخواسته اطلاعات شخصی جلوگیری شود.
 */
export interface UpdateOrderRatingDTO {
  orderId: string;
  rating: number;
}

/**
 * قرارداد ذخیرهٔ محلی **نسخهٔ نمایشی** (حافظهٔ همین مرورگر).
 *
 * ⚠️ این قرارداد عمومی مشتری نیست و جانشین HTTP نخواهد داشت: `getOrders` (فهرست سفارش‌ها) و
 * لغو و امتیاز مستقیم فقط برای رکوردهای همین مرورگر معنا دارند. اتصال‌های عملیاتی از
 * `CustomerOrderGateway` در `src/services/customerOrders/contract.ts` پیروی می‌کنند.
 *
 * توجه: متد تغییر وضعیت عملیاتی سفارش (`updateOrderStatus`) عمداً حذف شده است.
 * مشتری مجاز به جابه‌جایی وضعیت عملیاتی سفارش نیست.
 */
export interface IOrderService {
  getOrders(): Promise<BookingOrder[]>;
  getOrderById(id: string): Promise<BookingOrder | null>;
  getOrderByTrackingCode(trackingCode: string): Promise<BookingOrder | null>;
  createOrder(orderData: CreateOrderDTO): Promise<BookingOrder>;
  submitOrderRating(orderId: string, rating: number): Promise<BookingOrder>;
  cancelOrder(orderId: string): Promise<BookingOrder>;
}
