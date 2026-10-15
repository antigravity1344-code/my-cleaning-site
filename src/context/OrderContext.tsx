import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BookingOrder } from '../types';
import { orderService } from '../services/orderService';
import { CreateOrderDTO } from '../services/orderService.types';
import { hasLegacyStoredData } from '../services/pii';

interface OrderContextType {
  orders: BookingOrder[];
  isLoading: boolean;
  error: string | null;
  createOrder: (orderData: CreateOrderDTO) => Promise<BookingOrder>;
  /**
   * ثبت امتیاز عددی؛ وضعیت عملیاتی سفارش را تغییر نمی‌دهد و متن آزاد بازخورد
   * در حافظه مرورگر ذخیره نمی‌شود.
   */
  submitOrderRating: (orderId: string, rating: number) => Promise<BookingOrder>;
  /** لغو نمایشی رکورد محلی (هیچ اثری در سامانه عملیاتی ندارد). */
  cancelOrder: (orderId: string) => Promise<BookingOrder>;
  refreshOrders: () => Promise<void>;
  getOrderById: (id: string) => Promise<BookingOrder | null>;
  getOrderByTrackingCode: (trackingCode: string) => Promise<BookingOrder | null>;
  /**
   * آیا داده‌ای از نسخه قبلی سایت در همین مرورگر وجود دارد؟
   * فقط برای اطلاع‌رسانی؛ هیچ خواندن، انتقال یا حذفی انجام نمی‌شود.
   */
  hasLegacyStoredData: boolean;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

interface OrderProviderProps {
  children: ReactNode;
}

export const OrderProvider: React.FC<OrderProviderProps> = ({ children }) => {
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // فقط یک‌بار و صرفاً برای اطلاع‌رسانی بررسی می‌شود؛ هیچ داده‌ای دست‌کاری نمی‌شود.
  const [legacyDataPresent] = useState<boolean>(() => hasLegacyStoredData());

  // Load demo orders on initial mount
  const refreshOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedOrders = await orderService.getOrders();
      setOrders(fetchedOrders);
    } catch (err) {
      console.error('[OrderContext] Error fetching demo orders:', err);
      setError('خطا در دریافت فهرست درخواست‌های آزمایشی');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  // Create new demo order
  const handleCreateOrder = useCallback(async (orderData: CreateOrderDTO): Promise<BookingOrder> => {
    setError(null);
    try {
      const created = await orderService.createOrder(orderData);
      setOrders(prev => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('[OrderContext] Error creating demo order:', err);
      setError('خطا در ثبت درخواست آزمایشی');
      throw err;
    }
  }, []);

  // ثبت امتیاز عددی — مشتری وضعیت عملیاتی سفارش را تغییر نمی‌دهد و متن آزاد ذخیره نمی‌شود.
  //
  // توجه: orderService.submitOrderRating رکورد را از روی نسخه‌ی ماسک‌شده‌ای
  // که روی دیسک (localStorage) ذخیره شده می‌خواند و برمی‌گرداند. اگر این
  // سفارش را همین نشست ساخته باشیم، نسخه‌ی کامل (نام/شماره واقعی) فقط در
  // همین state (orders) وجود دارد. برای این‌که با جایگزینی کامل رکورد،
  // داده‌های واقعی به‌اشتباه با نسخه‌ی ماسک‌شده عوض نشوند، فقط فیلدهایی که
  // واقعاً توسط این عملیات تغییر کرده‌اند (امتیاز) روی رکورد موجود merge
  // می‌شود.
  const handleSubmitOrderRating = useCallback(
    async (orderId: string, rating: number): Promise<BookingOrder> => {
      setError(null);
      try {
        const stored = await orderService.submitOrderRating(orderId, rating);
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
    [],
  );

  // لغو نمایشی — همان دلیل بالا: فقط وضعیت را merge می‌کنیم تا نام/شماره/آدرس
  // واقعی سفارشی که همین نشست ساخته شده، با نسخه ماسک‌شده‌ی ذخیره‌شده جایگزین نشود.
  const handleCancelOrder = useCallback(async (orderId: string): Promise<BookingOrder> => {
    setError(null);
    try {
      const stored = await orderService.cancelOrder(orderId);
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
  }, []);

  // Fetch individual order
  const handleGetOrderById = useCallback(async (id: string): Promise<BookingOrder | null> => {
    return orderService.getOrderById(id);
  }, []);

  const handleGetOrderByTrackingCode = useCallback(async (trackingCode: string): Promise<BookingOrder | null> => {
    return orderService.getOrderByTrackingCode(trackingCode);
  }, []);

  const value: OrderContextType = {
    orders,
    isLoading,
    error,
    createOrder: handleCreateOrder,
    submitOrderRating: handleSubmitOrderRating,
    cancelOrder: handleCancelOrder,
    refreshOrders,
    getOrderById: handleGetOrderById,
    getOrderByTrackingCode: handleGetOrderByTrackingCode,
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
