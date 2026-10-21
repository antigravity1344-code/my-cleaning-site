import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BookingOrder } from '../types';
import { hasLegacyStoredData } from '../services/pii';
import {
  getActiveOrderBackend,
  OrderGatewayError,
  type OrderBackend,
  type OrderReceipt,
  type OrderRequest,
  type PublicTrackingView,
  type Quote,
  type QuoteRequest,
} from '../services/customerOrders';
import { createSubmissionCoordinator } from '../services/customerOrders/submissionCoordinator';

/**
 * لایهٔ اتصال کامپوننت‌ها به سفارش‌ها.
 *
 * کامپوننت‌ها فقط با همین context کار می‌کنند و نمی‌دانند کدام adapter فعال است. adapter
 * یک بار در `getActiveOrderBackend` از روی تنظیمات راه‌اندازی انتخاب می‌شود (یا برای آزمون
 * از ورودی `backend`). اگر adapter خطا بدهد، خطا به کامپوننت برمی‌گردد؛ هیچ بازگشت خودکار
 * و پنهانی به ذخیرهٔ نمایشی وجود ندارد.
 *
 * کلید تکرار و درخواستِ با نتیجهٔ نامشخص هم همین‌جا (در `submissionCoordinator`) نگه داشته
 * می‌شوند، نه در فرم؛ پس بستن و بازکردن فرم آن‌ها را از بین نمی‌برد.
 */
interface OrderContextType {
  backendMode: OrderBackend['mode'];
  /**
   * فقط نسخهٔ نمایشی: سفارش‌های همین مرورگر. در حالت‌های عملیاتی همیشه خالی است، چون
   * قرارداد عمومی مشتری فهرست سفارش‌ها را ارائه نمی‌کند.
   */
  orders: BookingOrder[];
  isLoading: boolean;
  error: string | null;
  getQuote: (request: QuoteRequest) => Promise<Quote>;
  /** کلید تکرار را لایهٔ اتصال می‌سازد و نگه می‌دارد؛ فرم فقط درخواست را می‌دهد. */
  submitOrderRequest: (request: OrderRequest) => Promise<OrderReceipt>;
  /**
   * درخواستی که نتیجهٔ ثبتش معلوم نیست (فقط در حافظهٔ همین صفحه). تا وقتی `null` نشده، درخواست
   * تازهٔ متفاوتی فرستاده نمی‌شود.
   */
  unresolvedSubmission: OrderRequest | null;
  /** همان درخواست نامشخص را با همان کلید تکرار دوباره می‌فرستد تا نتیجه روشن شود. */
  retryUnresolvedSubmission: () => Promise<OrderReceipt>;
  trackOrder: (trackingCode: string) => Promise<PublicTrackingView | null>;
  /**
   * فقط نسخهٔ نمایشی: ثبت امتیاز عددی روی رکورد محلی. وضعیت سفارش را تغییر نمی‌دهد و متن
   * آزاد بازخورد ذخیره نمی‌شود.
   */
  submitOrderRating: (orderId: string, rating: number) => Promise<BookingOrder>;
  /** فقط نسخهٔ نمایشی: لغو نمایشی رکورد محلی (هیچ اثری در سامانه عملیاتی ندارد). */
  cancelOrder: (orderId: string) => Promise<BookingOrder>;
  refreshOrders: () => Promise<void>;
  /**
   * آیا داده‌ای از نسخه قبلی سایت در همین مرورگر وجود دارد؟
   * فقط برای اطلاع‌رسانی؛ هیچ خواندن، انتقال یا حذفی انجام نمی‌شود.
   */
  hasLegacyStoredData: boolean;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

interface OrderProviderProps {
  children: ReactNode;
  /** فقط برای آزمون: adapter دیگری به جای adapter تنظیمات راه‌اندازی. */
  backend?: OrderBackend;
}

const demoOnly = (): Promise<never> =>
  Promise.reject(new OrderGatewayError('not_implemented', 'این امکان فقط در نسخهٔ نمایشی وجود دارد.'));

export const OrderProvider: React.FC<OrderProviderProps> = ({ children, backend: backendProp }) => {
  const [backend] = useState<OrderBackend>(() => backendProp ?? getActiveOrderBackend());
  const { gateway, demoLedger } = backend;
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // فقط یک‌بار و صرفاً برای اطلاع‌رسانی بررسی می‌شود؛ هیچ داده‌ای دست‌کاری نمی‌شود.
  const [legacyDataPresent] = useState<boolean>(() => hasLegacyStoredData());
  const [unresolvedSubmission, setUnresolvedSubmission] = useState<OrderRequest | null>(null);
  const [coordinator] = useState(() => createSubmissionCoordinator(gateway, setUnresolvedSubmission));

  const refreshOrders = useCallback(async () => {
    if (!demoLedger) {
      setOrders([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setOrders(await demoLedger.listLocalOrders());
    } catch (err) {
      console.error('[OrderContext] Error fetching demo orders:', err);
      setError('خطا در دریافت فهرست درخواست‌های آزمایشی');
    } finally {
      setIsLoading(false);
    }
  }, [demoLedger]);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  const trackSubmission = useCallback(
    async (submission: () => Promise<OrderReceipt>): Promise<OrderReceipt> => {
      setError(null);
      try {
        const receipt = await submission();
        // نسخهٔ نمایشی: نسخهٔ کامل همین نشست در فهرست محلی نشان داده می‌شود؛ روی دیسک فقط نسخهٔ ماسک‌شده است.
        const sessionRecord = demoLedger?.getSessionRecord(receipt.trackingCode);
        if (sessionRecord) {
          setOrders((prev) =>
            prev.some((order) => order.id === sessionRecord.id) ? prev : [sessionRecord, ...prev],
          );
        }
        return receipt;
      } catch (err) {
        console.error('[OrderContext] Error submitting order request:', err);
        setError('خطا در ثبت درخواست');
        throw err;
      }
    },
    [demoLedger],
  );

  const handleSubmitOrderRequest = useCallback(
    (request: OrderRequest) => trackSubmission(() => coordinator.submit(request)),
    [coordinator, trackSubmission],
  );

  const retryUnresolvedSubmission = useCallback(
    () => trackSubmission(() => coordinator.retryUnresolved()),
    [coordinator, trackSubmission],
  );

  // ثبت امتیاز عددی — مشتری وضعیت عملیاتی سفارش را تغییر نمی‌دهد و متن آزاد ذخیره نمی‌شود.
  //
  // توجه: ledger رکورد را از روی نسخه‌ی ماسک‌شده‌ای که روی دیسک (localStorage) ذخیره شده
  // می‌خواند و برمی‌گرداند. اگر این سفارش را همین نشست ساخته باشیم، نسخه‌ی کامل (نام/شماره
  // واقعی) فقط در همین state (orders) وجود دارد. برای این‌که با جایگزینی کامل رکورد،
  // داده‌های واقعی به‌اشتباه با نسخه‌ی ماسک‌شده عوض نشوند، فقط فیلدهایی که واقعاً توسط این
  // عملیات تغییر کرده‌اند (امتیاز) روی رکورد موجود merge می‌شود.
  const handleSubmitOrderRating = useCallback(
    async (orderId: string, rating: number): Promise<BookingOrder> => {
      if (!demoLedger) return demoOnly();
      setError(null);
      try {
        const stored = await demoLedger.submitOrderRating(orderId, rating);
        let merged: BookingOrder = stored;
        setOrders(prev =>
          prev.map(o => {
            if (o.id !== orderId) return o;
            merged = { ...o, userRating: stored.userRating };
            return merged;
          }),
        );
        return merged;
      } catch (err) {
        console.error('[OrderContext] Error submitting rating:', err);
        setError('خطا در ثبت امتیاز');
        throw err;
      }
    },
    [demoLedger],
  );

  // لغو نمایشی — همان دلیل بالا: فقط وضعیت را merge می‌کنیم تا نام/شماره/آدرس
  // واقعی سفارشی که همین نشست ساخته شده، با نسخه ماسک‌شده‌ی ذخیره‌شده جایگزین نشود.
  const handleCancelOrder = useCallback(
    async (orderId: string): Promise<BookingOrder> => {
      if (!demoLedger) return demoOnly();
      setError(null);
      try {
        const stored = await demoLedger.cancelOrder(orderId);
        let merged: BookingOrder = stored;
        setOrders(prev =>
          prev.map(o => {
            if (o.id !== orderId) return o;
            merged = { ...o, status: stored.status };
            return merged;
          }),
        );
        return merged;
      } catch (err) {
        console.error('[OrderContext] Error cancelling demo order:', err);
        setError('خطا در لغو درخواست آزمایشی');
        throw err;
      }
    },
    [demoLedger],
  );

  const getQuote = useCallback((request: QuoteRequest) => gateway.getQuote(request), [gateway]);
  const trackOrder = useCallback((trackingCode: string) => gateway.trackOrder(trackingCode), [gateway]);

  const value: OrderContextType = {
    backendMode: backend.mode,
    orders,
    isLoading,
    error,
    getQuote,
    submitOrderRequest: handleSubmitOrderRequest,
    unresolvedSubmission,
    retryUnresolvedSubmission,
    trackOrder,
    submitOrderRating: handleSubmitOrderRating,
    cancelOrder: handleCancelOrder,
    refreshOrders,
    hasLegacyStoredData: legacyDataPresent,
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = (): OrderContextType => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};
