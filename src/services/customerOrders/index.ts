import { ORDER_BACKEND_MODE } from '../../config/orderBackend';
import { orderService } from '../orderService';
import type { CustomerOrderGateway, OrderBackendMode } from './contract';
import { createDemoOrderBackend, type DemoOrderLedger } from './demoGateway';
import { createUnavailableGateway } from './unavailableGateway';

/**
 * تنها نقطهٔ انتخاب adapter سفارش.
 *
 * فرم‌ها و کامپوننت‌ها فقط `gateway` (قرارداد عمومی مشتری) را می‌بینند. امکانات فقط‌نمایشی
 * (فهرست سفارش‌های همین مرورگر، امتیاز و لغو محلی) جدا در `demoLedger` است و در حالت‌های
 * عملیاتی `null` است.
 */
export interface OrderBackend {
  /** `misconfigured` یعنی مقدار `VITE_ORDER_BACKEND` نامعتبر است. */
  mode: OrderBackendMode | 'misconfigured';
  gateway: CustomerOrderGateway;
  demoLedger: DemoOrderLedger | null;
}

export const createOrderBackend = (mode: OrderBackendMode | null): OrderBackend => {
  switch (mode) {
    case 'demo': {
      const demo = createDemoOrderBackend(orderService);
      return { mode, gateway: demo.gateway, demoLedger: demo.ledger };
    }
    case 'standalone':
    case 'coordinated':
      return { mode, gateway: createUnavailableGateway(mode), demoLedger: null };
    default:
      return { mode: 'misconfigured', gateway: createUnavailableGateway('misconfigured'), demoLedger: null };
  }
};

let activeBackend: OrderBackend | null = null;

/** adapter انتخاب‌شده در تنظیمات راه‌اندازی (یک بار ساخته می‌شود). */
export const getActiveOrderBackend = (): OrderBackend => {
  if (!activeBackend) {
    activeBackend = createOrderBackend(ORDER_BACKEND_MODE);
    if (activeBackend.mode === 'misconfigured') {
      console.error('[orders] VITE_ORDER_BACKEND نامعتبر است؛ ثبت سفارش غیرفعال شد.');
    }
  }
  return activeBackend;
};

export * from './contract';
export type { DemoOrderLedger } from './demoGateway';
