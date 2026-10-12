import { BookingOrder } from '../types';
import { CreateOrderDTO, IOrderService } from './orderService.types';
import { DEMO_MODE } from '../config/capabilities';
import {
  DEMO_STORAGE_KEY,
  purgeLegacyStorage,
  redactOrderForStorage,
  safeLocalStorage,
} from './pii';
import { DEMO_ORDER_STATUS, DEMO_TRACKING_PREFIX, generateDemoTrackingCode } from './demoOrder';

/**
 * پیاده‌سازی نمایشی سرویس سفارش روی حافظه مرورگر.
 *
 * ⚠️ وضعیت فعلی: این سرویس به هیچ سروری متصل نیست. بنابراین:
 *   • سفارش‌ها هرگز به تیم عملیات پاک‌شو نمی‌رسند و «تأیید» نمی‌شوند،
 *   • وضعیت ذخیره‌شده یک وضعیت عملیاتی واقعی نیست و صرفاً نمایش آزمایشی است،
 *   • اطلاعات هویتی مشتری پیش از ذخیره‌سازی ماسک/حذف می‌شود،
 *   • کد پیگیری با پیشوند DEMO- ساخته می‌شود تا با کد عملیاتی سرور اشتباه نشود.
 *
 * امضای متدها async و مطابق `IOrderService` است تا در مأموریت یکپارچه‌سازی،
 * جانشینی با نسخه HTTP بدون تغییر کامپوننت‌ها انجام شود.
 */
class DemoLocalOrderService implements IOrderService {
  private getStoredOrders(): BookingOrder[] {
    const storage = safeLocalStorage();
    if (!storage) return [];

    try {
      // کلید نسخه قبلی که ممکن بود اطلاعات خام مشتری داشته باشد پاک می‌شود.
      purgeLegacyStorage(storage);

      const saved = storage.getItem(DEMO_STORAGE_KEY);
      if (!saved) return [];

      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      // فقط رکوردهای ساختاراً معتبر نگه داشته می‌شوند.
      return parsed.filter(
        (item): item is BookingOrder =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as BookingOrder).id === 'string' &&
          typeof (item as BookingOrder).trackingCode === 'string',
      );
    } catch (error) {
      console.error('[DemoLocalOrderService] Failed to read demo orders:', error);
      return [];
    }
  }

  private saveStoredOrders(orders: BookingOrder[]): void {
    const storage = safeLocalStorage();
    if (!storage) return;
    try {
      // اطلاعات هویتی مشتری پیش از نوشتن روی دیسک حذف/ماسک می‌شود.
      const redacted = orders.map(redactOrderForStorage);
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(redacted));
    } catch (error) {
      console.error('[DemoLocalOrderService] Failed to save demo orders:', error);
      throw new Error('ذخیره‌سازی محلی سفارش آزمایشی ناموفق بود (فضای حافظه مرورگر).');
    }
  }

  public async getOrders(): Promise<BookingOrder[]> {
    return this.getStoredOrders();
  }

  public async getOrderById(id: string): Promise<BookingOrder | null> {
    return this.getStoredOrders().find((order) => order.id === id) ?? null;
  }

  public async getOrderByTrackingCode(trackingCode: string): Promise<BookingOrder | null> {
    const code = trackingCode.trim().toUpperCase();
    if (!code) return null;
    return this.getStoredOrders().find((order) => order.trackingCode.toUpperCase() === code) ?? null;
  }

  public async createOrder(orderData: CreateOrderDTO): Promise<BookingOrder> {
    const orders = this.getStoredOrders();
    const trackingCode = generateDemoTrackingCode(
      orders.map((order) => order.trackingCode),
    );

    const newOrder: BookingOrder = {
      ...orderData,
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      trackingCode,
      createdAt: new Date().toISOString(),
      status: DEMO_ORDER_STATUS,
      recordType: orderData.recordType ?? 'demo',
      paymentStatus: orderData.paymentStatus ?? 'unpaid',
    };

    const updated = [newOrder, ...orders];
    this.saveStoredOrders(updated);

    // نسخه کامل فقط در حافظه همین نشست برمی‌گردد تا کاربر همان لحظه بتواند
    // اطلاعات درخواست خودش را ببیند؛ روی دیسک فقط نسخه ماسک‌شده می‌ماند.
    return newOrder;
  }

  /**
   * ثبت امتیاز و بازخورد مشتری روی سفارش آزمایشی.
   * توجه: وضعیت عملیاتی سفارش تغییر نمی‌کند؛ مشتری مجاز به تغییر وضعیت نیست.
   */
  public async submitOrderRating(orderId: string, rating: number, feedback?: string): Promise<BookingOrder> {
    const orders = this.getStoredOrders();
    let updatedOrder: BookingOrder | null = null;

    const updated = orders.map((order) => {
      if (order.id !== orderId) return order;
      updatedOrder = {
        ...order,
        // وضعیت عیناً حفظ می‌شود؛ فقط بازخورد ثبت می‌گردد.
        userRating: rating,
        userFeedback: feedback,
      };
      return updatedOrder;
    });

    if (!updatedOrder) {
      throw new Error(`سفارش آزمایشی با شناسه ${orderId} یافت نشد.`);
    }

    this.saveStoredOrders(updated);
    return updatedOrder;
  }

  /**
   * لغو درخواست آزمایشی.
   * این عملیات فقط رکورد محلی را علامت می‌زند و هیچ اثری در سامانه عملیاتی ندارد،
   * چون هیچ درخواستی به سامانه عملیاتی ارسال نشده است.
   */
  public async cancelOrder(orderId: string): Promise<BookingOrder> {
    const orders = this.getStoredOrders();
    let updatedOrder: BookingOrder | null = null;

    const updated = orders.map((order) => {
      if (order.id !== orderId) return order;
      updatedOrder = { ...order, status: 'cancelled' };
      return updatedOrder;
    });

    if (!updatedOrder) {
      throw new Error(`سفارش آزمایشی با شناسه ${orderId} یافت نشد.`);
    }

    this.saveStoredOrders(updated);
    return updatedOrder;
  }
}

// Export singleton instance as current provider.
// جانشینی با نسخه HTTP/سرور در مأموریت یکپارچه‌سازی اینجا انجام می‌شود.
export const orderService: IOrderService = new DemoLocalOrderService();

export { DEMO_MODE, DEMO_TRACKING_PREFIX };
