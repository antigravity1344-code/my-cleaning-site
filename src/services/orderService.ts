import { BookingOrder } from '../types';
import { CreateOrderDTO, IOrderService } from './orderService.types';
import { DEMO_MODE } from '../config/capabilities';
import { DEMO_STORAGE_KEY, redactOrderForStorage, safeLocalStorage } from './pii';
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
 * کامپوننت‌ها مستقیماً از این سرویس استفاده نمی‌کنند؛ فقط adapter نمایشی
 * (`src/services/customerOrders/demoGateway.ts`) آن را صدا می‌زند. اتصال عملیاتی
 * جانشین این فایل نیست، بلکه adapter دیگری از همان قرارداد عمومی مشتری است.
 */
const isStoredOrder = (item: unknown): item is BookingOrder =>
  typeof item === 'object' &&
  item !== null &&
  typeof (item as BookingOrder).id === 'string' &&
  typeof (item as BookingOrder).trackingCode === 'string';

/**
 * نتیجه خواندن حافظه سفارش‌های آزمایشی.
 * - `clean`: حافظه یا خالی است یا کامل و سالم خوانده شد؛ نوشتن روی آن امن است.
 * - `unavailable` / `unreadable` / `corrupted`: نوشتن روی آن **امن نیست**، چون
 *   بازنویسی، رکوردهای قبلی را که نتوانستیم بخوانیم بی‌صدا پاک می‌کند.
 */
type StoreReadResult =
  | { status: 'clean'; orders: BookingOrder[] }
  | { status: 'unavailable' | 'unreadable' | 'corrupted'; orders: BookingOrder[] };

const STORE_WRITE_REFUSED_MESSAGE: Record<Exclude<StoreReadResult['status'], 'clean'>, string> = {
  unavailable: 'ذخیره‌سازی محلی سفارش آزمایشی در دسترس نیست.',
  unreadable:
    'ذخیره‌سازی محلی سفارش آزمایشی خوانده نشد؛ برای جلوگیری از پاک شدن رکوردهای قبلی، چیزی نوشته نشد.',
  corrupted:
    'ذخیره‌سازی محلی: داده سفارش‌های آزمایشی قبلی در این مرورگر قابل خواندن نیست؛ برای جلوگیری از پاک شدن آن، چیزی نوشته نشد.',
};

class DemoLocalOrderService implements IOrderService {
  private readStore(): StoreReadResult {
    const storage = safeLocalStorage();
    if (!storage) return { status: 'unavailable', orders: [] };

    let saved: string | null;
    try {
      // توجه: این سرویس داده‌های نسخه قبلی (`paksho_orders`) را نمی‌خواند، منتقل
      // یا حذف نمی‌کند؛ فقط کلید نسخه فعلی را می‌خواند. حذف/مهاجرت داده قدیمی
      // نیازمند تصمیم جداگانه مالک داده است.
      saved = storage.getItem(DEMO_STORAGE_KEY);
    } catch (error) {
      console.error('[DemoLocalOrderService] Failed to read demo orders:', error);
      return { status: 'unreadable', orders: [] };
    }
    if (!saved) return { status: 'clean', orders: [] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(saved);
    } catch (error) {
      console.error('[DemoLocalOrderService] Stored demo orders are not valid JSON:', error);
      return { status: 'corrupted', orders: [] };
    }
    if (!Array.isArray(parsed)) return { status: 'corrupted', orders: [] };

    const orders = parsed.filter(isStoredOrder);
    // اگر حتی یک رکورد ساختار نامعتبر داشته باشد، نمایش رکوردهای سالم مجاز است اما
    // نوشتن مجاز نیست؛ در غیر این صورت رکورد نامعتبر در بازنویسی بعدی گم می‌شود.
    return { status: orders.length === parsed.length ? 'clean' : 'corrupted', orders };
  }

  /** خواندن برای نمایش: بهترین تلاش، بدون هیچ نوشتنی. */
  private getStoredOrders(): BookingOrder[] {
    return this.readStore().orders;
  }

  /**
   * خواندن پیش از نوشتن: فقط وقتی حافظه کامل و سالم خوانده شده باشد ادامه می‌دهد.
   * در غیر این صورت خطا می‌دهد تا رکوردهای قبلی هرگز بی‌صدا بازنویسی و پاک نشوند.
   */
  private getStoredOrdersForWrite(): BookingOrder[] {
    const result = this.readStore();
    if (result.status !== 'clean') {
      throw new Error(STORE_WRITE_REFUSED_MESSAGE[result.status]);
    }
    return result.orders;
  }

  private saveStoredOrders(orders: BookingOrder[]): void {
    const storage = safeLocalStorage();
    if (!storage) throw new Error('ذخیره‌سازی محلی سفارش آزمایشی در دسترس نیست.');
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
    // خواندن ایمن برای نوشتن: اگر داده قبلی خوانا نباشد، سفارش جدید آن را پاک نمی‌کند.
    const orders = this.getStoredOrdersForWrite();
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
   * ثبت امتیاز مشتری روی سفارش آزمایشی.
   *
   * توجه ۱: وضعیت عملیاتی سفارش تغییر نمی‌کند؛ مشتری مجاز به تغییر وضعیت نیست.
   * توجه ۲: **فقط امتیاز عددی ذخیره می‌شود.** متن آزاد بازخورد ذخیره نمی‌شود،
   * چون می‌تواند به‌طور ناخواسته حاوی شماره تماس یا نشانی باشد و پس از ذخیره
   * قابل پاک‌سازی مطمئن نیست. متن بازخورد فقط در همان نشست در حافظه کامپوننت
   * نگه داشته و نمایش داده می‌شود.
   */
  public async submitOrderRating(orderId: string, rating: number): Promise<BookingOrder> {
    const orders = this.getStoredOrdersForWrite();
    let updatedOrder: BookingOrder | null = null;

    const updated = orders.map((order) => {
      if (order.id !== orderId) return order;
      updatedOrder = {
        ...order,
        // وضعیت عیناً حفظ می‌شود؛ فقط امتیاز عددی ثبت می‌گردد.
        userRating: rating,
      };
      // حذف احتمالی متن بازخورد از رکوردهای قدیمی‌تر همین نسخه.
      delete (updatedOrder as BookingOrder & { userFeedback?: string }).userFeedback;
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
    const orders = this.getStoredOrdersForWrite();
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

// تنها نمونهٔ ذخیرهٔ نمایشی؛ فقط adapter نمایشی از آن استفاده می‌کند.
export const orderService: IOrderService = new DemoLocalOrderService();

export { DEMO_MODE, DEMO_TRACKING_PREFIX };
