import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { BookingOrder } from '../types';
import { orderService } from '../services/orderService';
import { CreateOrderDTO, UpdateOrderStatusDTO } from '../services/orderService.types';

interface OrderContextType {
  orders: BookingOrder[];
  isLoading: boolean;
  error: string | null;
  createOrder: (orderData: CreateOrderDTO) => Promise<BookingOrder>;
  updateOrderStatus: (updateData: UpdateOrderStatusDTO) => Promise<BookingOrder>;
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

  // Load orders on initial mount
  const refreshOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedOrders = await orderService.getOrders();
      setOrders(fetchedOrders);
    } catch (err) {
      console.error('[OrderContext] Error fetching orders:', err);
      setError('خطا در دریافت لیست سفارش‌ها');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  // Create new order
  const handleCreateOrder = useCallback(async (orderData: CreateOrderDTO): Promise<BookingOrder> => {
    setError(null);
    try {
      const created = await orderService.createOrder(orderData);
      setOrders(prev => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('[OrderContext] Error creating order:', err);
      setError('خطا در ایجاد سفارش');
      throw err;
    }
  }, []);

  // Update order status or rating
  const handleUpdateOrderStatus = useCallback(async (updateData: UpdateOrderStatusDTO): Promise<BookingOrder> => {
    setError(null);
    try {
      const updated = await orderService.updateOrderStatus(updateData);
      setOrders(prev => prev.map(o => (o.id === updateData.orderId ? updated : o)));
      return updated;
    } catch (err) {
      console.error('[OrderContext] Error updating order status:', err);
      setError('خطا در به‌روزرسانی وضعیت سفارش');
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
    updateOrderStatus: handleUpdateOrderStatus,
    refreshOrders,
    getOrderById: handleGetOrderById,
    getOrderByTrackingCode: handleGetOrderByTrackingCode
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
