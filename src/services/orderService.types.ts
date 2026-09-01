import { BookingOrder, OrderStatus } from '../types';

export interface CreateOrderDTO {
  serviceId: BookingOrder['serviceId'];
  serviceTitle: BookingOrder['serviceTitle'];
  cleanerGender: BookingOrder['cleanerGender'];
  cleanerId?: string;
  cleanerName?: string;
  cleanerPhone?: string;
  cleanerAvatar?: string;
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
  status?: OrderStatus;
}

export interface UpdateOrderStatusDTO {
  orderId: string;
  status: OrderStatus;
  userRating?: number;
  userFeedback?: string;
}

export interface IOrderService {
  getOrders(): Promise<BookingOrder[]>;
  getOrderById(id: string): Promise<BookingOrder | null>;
  getOrderByTrackingCode(trackingCode: string): Promise<BookingOrder | null>;
  createOrder(orderData: CreateOrderDTO): Promise<BookingOrder>;
  updateOrderStatus(updateData: UpdateOrderStatusDTO): Promise<BookingOrder>;
}
