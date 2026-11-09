import { ADDON_OPTIONS, DISCOUNT_CODES, SERVICES_LIST } from '../data/mockData';
import type { AddonOption, ServiceItem } from '../types';

/**
 * دادهٔ پیکربندی موتور قیمت — جدا از خودِ موتور.
 *
 * هدف: موتور قیمت (`pricingEngine.ts`) دیگر مستقیماً از `mockData` نخواند، بلکه این
 * داده را به‌عنوان ورودی بگیرد. این‌طوری بعداً وقتی سرور پیکربندی واقعی (قیمت‌ها،
 * خدمات، کدهای تخفیف) را فراهم کند، همان موتور بدون تغییر رفتار، با دادهٔ سرور هم
 * کار می‌کند. در حالت نمایشی فعلی، مقدار پیش‌فرض همان `mockData` قبلی است — هیچ
 * رفتاری عوض نشده.
 */
export interface PricingData {
  services: ServiceItem[];
  addons: AddonOption[];
  /** نگاشت کد تخفیف به مبلغ (تومان). */
  discountCodes: Record<string, number>;
  /** قیمت پکیج مواد شوینده و دستمال نانو (تومان). */
  detergentPackagePrice: number;
  /**
   * نرخ تخفیف سراسری «رزرو آنلاین».
   *
   * ⚠️ ابهام کسب‌وکاری تأییدنشده — تا تصمیم رسمی مالک، مقدار آن `null` است و هیچ
   * تخفیف سراسری‌ای اعمال یا وعده داده نمی‌شود. شرح کامل در تاریخچهٔ `pricingEngine.ts`.
   */
  onlineBookingDiscountRate: number | null;
}

/** دادهٔ پیش‌فرض — همان مقادیر نمایشی قبلی، بدون تغییر. */
export const DEFAULT_PRICING_DATA: PricingData = {
  services: SERVICES_LIST,
  addons: ADDON_OPTIONS,
  discountCodes: DISCOUNT_CODES,
  detergentPackagePrice: 140_000,
  onlineBookingDiscountRate: null,
};
