export type ServiceType =
  | 'home-standard'
  | 'home-deep'
  | 'office'
  | 'building-staircase'
  | 'furniture-carpet'
  | 'post-construction'
  | 'disinfection';

export type CleanerGender = 'female' | 'male' | 'no-pref';

export interface ServiceItem {
  id: ServiceType;
  title: string;
  shortDesc: string;
  fullDesc: string;
  iconName: string;
  baseHourlyRate: number; // in Tomans
  minHours: number;
  popular?: boolean;
  included: string[];
  excluded: string[];
  bannerImage: string;
}

export interface AddonOption {
  id: string;
  title: string;
  price: number; // in Tomans
  description: string;
  icon: string;
}

export interface CleanerSpecialist {
  id: string;
  /** پروفایل‌های فعلی «نمونه» هستند و نباید به‌عنوان متخصص واقعی معرفی شوند. */
  recordType: RecordType;
  name: string;
  gender: CleanerGender;
  avatar: string;
  rating: number;
  reviewCount: number;
  completedOrders: number;
  experienceYears: number;
  specialties: string[];
  badge: string;
  verified: boolean;
  bio: string;
  satisfactionRate: number;
}

/**
 * نوع رکورد: داده‌های «نمونه» هرگز نباید به‌عنوان اطلاعات واقعی مشتری یا سفارش
 * عملیاتی معرفی شوند و باید در رابط کاربری متمایز و برچسب‌دار باشند.
 */
export type RecordType = 'sample' | 'demo';

export interface CustomerReview {
  id: string;
  authorName: string;
  serviceType: string;
  rating: number;
  date: string;
  comment: string;
  avatar?: string;
  cleanerName?: string;
  /** فقط زمانی true می‌شود که سفارش متناظر واقعاً احراز شده باشد (نیازمند سرور). */
  verifiedBooking: boolean;
  recordType: RecordType;
}

export type OrderStatus =
  | 'pending' // ثبت شده در انتظار تایید
  | 'assigned' // نیروی خدماتی تعیین شد
  | 'on_the_way' // در حال اعزام به محل
  | 'in_progress' // در حال انجام نظافت
  | 'completed' // با موفقیت انجام شد
  | 'cancelled'; // لغو شده

export type PaymentStatus = 'unpaid' | 'paid';

export interface BookingOrder {
  id: string;
  trackingCode: string;
  createdAt: string;
  /**
   * در نسخه آزمایشی، وضعیت نمایشی است و وضعیت عملیاتی واقعی محسوب نمی‌شود.
   */
  status: OrderStatus;
  recordType: RecordType;
  /** در نسخه آزمایشی همیشه «unpaid» است؛ هیچ پرداختی ثبت نمی‌شود. */
  paymentStatus: PaymentStatus;
  serviceId: ServiceType;
  serviceTitle: string;
  cleanerGender: CleanerGender;
  /** تنها در صورت تخصیص تأییدشده توسط سرور مقدار می‌گیرد. */
  cleanerId?: string;
  cleanerName?: string;
  cleanerPhone?: string;
  cleanerAvatar?: string;
  /** انتخاب نمایشی کاربر از فهرست نمونه (به‌معنای تخصیص متخصص نیست). */
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
  userRating?: number;
  userFeedback?: string;
}

export interface FAQItem {
  id: string;
  category: 'booking' | 'pricing' | 'safety' | 'services';
  question: string;
  answer: string;
}

export interface CleaningTip {
  id: string;
  title: string;
  category: string;
  readTime: string;
  summary: string;
  content: string;
  image: string;
}
