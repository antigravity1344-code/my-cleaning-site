import { BookingOrder } from '../types';
import { INITIAL_ORDERS } from '../data/mockData';
import { CreateOrderDTO, IOrderService, UpdateOrderStatusDTO } from './orderService.types';

const STORAGE_KEY = 'paksho_orders';

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

// Export singleton instance as current provider
export const orderService: IOrderService = new LocalStorageOrderService();
