import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BookingOrder } from '../types';
import { orderService } from '../services/orderService';
import { CreateOrderDTO } from '../services/orderService.types';

interface OrderContextType {
  orders: BookingOrder[];
  isLoading: boolean;
  error: string | null;
  createOrder: (orderData: CreateOrderDTO) => Promise<BookingOrder>;
  /** ثبت امتیاز/بازخورد؛ وضعیت عملیاتی سفارش را تغییر نمی‌دهد. */
  submitOrderRating: (orderId: string, rating: number, feedback?: string) => Promise<BookingOrder>;
  /** لغو نمایشی رکورد محلی (هیچ اثری در سامانه عملیاتی ندارد). */
  cancelOrder: (orderId: string) => Promise<BookingOrder>;
  refreshOrders: () => Promise<void>;
  getOrderById: (id: string) => Promise<BookingOrder | null>;
  getOrderByTrackingCode: (trackingCode: string) => Promise<BookingOrder | null>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

interface OrderProviderProps {
  children: ReactNode;
}

export const OrderProvider: React.FC<OrderProviderProps> = ({ children }) => {
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  // Submit rating/feedback only — no operational status change by the customer
  const handleSubmitOrderRating = useCallback(
    async (orderId: string, rating: number, feedback?: string): Promise<BookingOrder> => {
      setError(null);
      try {
        const updated = await orderService.submitOrderRating(orderId, rating, feedback);
        setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
        return updated;
      } catch (err) {
        console.error('[OrderContext] Error submitting rating:', err);
        setError('خطا در ثبت امتیاز');
        throw err;
      }
    },
    [],
  );

  const handleCancelOrder = useCallback(async (orderId: string): Promise<BookingOrder> => {
    setError(null);
    try {
      const updated = await orderService.cancelOrder(orderId);
      setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
      return updated;
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
