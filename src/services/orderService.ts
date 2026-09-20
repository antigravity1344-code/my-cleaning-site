import { BookingOrder } from '../types';
import { INITIAL_ORDERS } from '../data/mockData';
import { CreateOrderDTO, IOrderService, UpdateOrderStatusDTO } from './orderService.types';

const STORAGE_KEY = 'paksho_orders';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');

class ApiOrderService implements IOrderService {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      let message = 'ارتباط با سرور برقرار نشد.';

      try {
        const errorBody = (await response.json()) as { message?: string };
        message = errorBody.message || message;
      } catch {
        // The API may return an empty or non-JSON error response.
      }

      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  public getOrders(): Promise<BookingOrder[]> {
    return this.request<BookingOrder[]>('/orders');
  }

  public getOrderById(id: string): Promise<BookingOrder | null> {
    return this.request<BookingOrder | null>(`/orders/${encodeURIComponent(id)}`);
  }

  public getOrderByTrackingCode(trackingCode: string): Promise<BookingOrder | null> {
    return this.request<BookingOrder | null>(`/orders/tracking/${encodeURIComponent(trackingCode)}`);
  }

  public createOrder(orderData: CreateOrderDTO): Promise<BookingOrder> {
    return this.request<BookingOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  public updateOrderStatus(updateData: UpdateOrderStatusDTO): Promise<BookingOrder> {
    const { orderId, ...payload } = updateData;

    return this.request<BookingOrder>(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
}

/**
 * LocalStorage implementation of Order Service.
 * Implements IOrderService with asynchronous signatures, ready for real API replacement.
 */
class LocalStorageOrderService implements IOrderService {
  private getStoredOrders(): BookingOrder[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('[LocalStorageOrderService] Failed to read from localStorage:', error);
    }
    // Return initial/mock demo orders if storage is empty
    return INITIAL_ORDERS;
  }

  private saveStoredOrders(orders: BookingOrder[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (error) {
      console.error('[LocalStorageOrderService] Failed to save to localStorage:', error);
    }
  }

  public async getOrders(): Promise<BookingOrder[]> {
    return this.getStoredOrders();
  }

  public async getOrderById(id: string): Promise<BookingOrder | null> {
    const orders = this.getStoredOrders();
    const found = orders.find(order => order.id === id);
    return found || null;
  }

  public async getOrderByTrackingCode(trackingCode: string): Promise<BookingOrder | null> {
    const orders = this.getStoredOrders();
    const code = trackingCode.trim().toUpperCase();
    const found = orders.find(order => order.trackingCode.toUpperCase() === code);
    return found || null;
  }

  public async createOrder(orderData: CreateOrderDTO): Promise<BookingOrder> {
    const orders = this.getStoredOrders();
    const randomTrackingNum = Math.floor(10000 + Math.random() * 90000);
    const trackingCode = `PAK-${randomTrackingNum}`;

    const newOrder: BookingOrder = {
      ...orderData,
      id: `ord-${Date.now()}`,
      trackingCode,
      createdAt: 'هم‌اکنون',
      status: orderData.status || 'assigned'
    };

    const updated = [newOrder, ...orders];
    this.saveStoredOrders(updated);
    return newOrder;
  }

  public async updateOrderStatus(updateData: UpdateOrderStatusDTO): Promise<BookingOrder> {
    const orders = this.getStoredOrders();
    let updatedOrder: BookingOrder | null = null;

    const updated = orders.map(order => {
      if (order.id === updateData.orderId) {
        updatedOrder = {
          ...order,
          status: updateData.status,
          userRating: updateData.userRating !== undefined ? updateData.userRating : order.userRating,
          userFeedback: updateData.userFeedback !== undefined ? updateData.userFeedback : order.userFeedback
        };
        return updatedOrder;
      }
      return order;
    });

    if (!updatedOrder) {
      throw new Error(`Order with ID ${updateData.orderId} was not found.`);
    }

    this.saveStoredOrders(updated);
    return updatedOrder;
  }
}

// Local storage keeps the public demo runnable until the production API is deployed.
// Set VITE_API_BASE_URL to switch every order operation to the backend API.
export const orderService: IOrderService = API_BASE_URL
  ? new ApiOrderService(API_BASE_URL)
  : new LocalStorageOrderService();
