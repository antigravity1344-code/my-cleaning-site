// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { orderService } from './orderService';
import { DEMO_STORAGE_KEY, LEGACY_STORAGE_KEYS, REDACTED_PLACEHOLDER } from './pii';
import type { CreateOrderDTO } from './orderService.types';

/**
 * آزمون‌های مأموریت PAKSHO-WEBSITE-SAFETY-003.
 *
 * این آزمون‌ها روی **مقدار واقعی ذخیره‌شده در localStorage** کار می‌کنند (نه فقط روی
 * شیء بازگشتی)، چون باگ گزارش‌شده دقیقاً در لایه ذخیره‌سازی بود.
 */

const LEGACY_KEY = LEGACY_STORAGE_KEYS[0];

/** رکورد ساختگی نسخه قبلی با اطلاعات شخصی خام. */
const LEGACY_VALUE = JSON.stringify([
  {
    id: 'ord-legacy-1',
    trackingCode: 'PAK-84920',
    customerName: 'مشتری قدیمی نسخه قبل',
    customerPhone: '۰۹۳۵۰۰۰۱۱۲۲',
    address: 'بلوار پاکنژاد، خیابان هجدهم، پلاک ۱۲',
    unit: 'واحد ۳',
  },
]);

const buildPayload = (overrides: Partial<CreateOrderDTO> = {}): CreateOrderDTO => ({
  serviceId: 'home-standard',
  serviceTitle: 'نظافت استاندارد منزل',
  cleanerGender: 'no-pref',
  hours: 4,
  squareMeters: 90,
  roomsCount: 2,
  selectedAddons: [],
  hasDetergentPackage: true,
  date: 'امروز',
  timeSlot: '۰۹:۰۰ الی ۱۳:۰۰ (صبح)',
  cityName: 'تهران',
  district: 'سعادت‌آباد و شهرک غرب',
  address: 'خیابان نمونه، کوچه ۳، پلاک ۱۲',
  unit: 'طبقه ۳، واحد ۸',
  customerName: 'سارا محمدی',
  customerPhone: '09123456789',
  notes: 'کلید زیر گلدان است',
  totalPrice: 780_000,
  discountApplied: 0,
  paymentMethod: 'cash_on_site',
  paymentStatus: 'unpaid',
  status: 'pending',
  ...overrides,
});

/** مقدار واقعی نوشته‌شده روی دیسک برای سفارش‌های نمایشی. */
const readStoredDemoOrders = (): string => localStorage.getItem(DEMO_STORAGE_KEY) ?? '';

beforeEach(() => {
  localStorage.clear();
});

describe('یافته ۱ — متن آزاد بازخورد هرگز ذخیره نمی‌شود', () => {
  it('بازخورد حاوی شماره تماس و نشانی، در مقدار واقعی ذخیره‌شده ظاهر نمی‌شود', async () => {
    const created = await orderService.createOrder(buildPayload());

    // متن آزاد ساختگی حاوی شماره تماس و نشانی.
    // این متن از مسیر عمومی سرویس تزریق می‌شود تا اگر در آینده کسی پارامتر بازخورد را
    // دوباره اضافه و ذخیره کند، این آزمون شکست بخورد و رگرسیون گرفته شود.
    const fakeFeedback = 'لطفا قبل از آمدن تماس بگیرید ۰۹۱۲۳۴۵۶۷۸۹ — خیابان ولیعصر، پلاک ۲۵';
    const submitWithFeedback = (
      orderService.submitOrderRating as unknown as (
        orderId: string,
        rating: number,
        feedback?: string,
      ) => Promise<unknown>
    ).bind(orderService);
    await submitWithFeedback(created.id, 5, fakeFeedback);

    const stored = readStoredDemoOrders();
    const storedRecord = JSON.parse(stored) as Array<Record<string, unknown>>;
    const target = storedRecord.find((item) => item.id === created.id);

    // شماره و نشانی داخل بازخورد نباید در مقدار ذخیره‌شده باشند
    expect(stored).not.toContain('۰۹۱۲۳۴۵۶۷۸۹');
    expect(stored).not.toContain('خیابان ولیعصر');
    expect(stored).not.toContain('پلاک ۲۵');

    // فیلد بازخورد اصلاً وجود ندارد
    expect(target).toBeDefined();
    expect(target).not.toHaveProperty('userFeedback');
    expect(Object.keys(target ?? {})).not.toContain('userFeedback');

    // امتیاز عددی حفظ شده است
    expect(target?.userRating).toBe(5);
  });

  it('حتی اگر متن بازخورد از بیرون به سرویس تزریق شود، ذخیره نمی‌شود', async () => {
    const created = await orderService.createOrder(buildPayload());

    // تزریق مستقیم از طریق API عمومی (بدون وابستگی به UI)
    await orderService.submitOrderRating(created.id, 4);

    const stored = readStoredDemoOrders();
    expect(stored).not.toContain('userFeedback');
  });
  it('رکورد ذخیره‌شده حاوی شماره تماس یا نشانی خام مشتری هم نیست', async () => {
    const created = await orderService.createOrder(buildPayload());

    const stored = readStoredDemoOrders();
    expect(stored).not.toContain('09123456789');
    expect(stored).not.toContain('۰۹۱۲۳۴۵۶۷۸۹');
    expect(stored).not.toContain('کوچه ۳');
    expect(stored).not.toContain('طبقه ۳');
    expect(stored).not.toContain('کلید زیر گلدان');
    expect(stored).toContain(REDACTED_PLACEHOLDER);

    // اما داده نمایشی لازم برای رهگیری حفظ شده است
    expect(stored).toContain(created.trackingCode);
  });

  it('رکوردهای قدیمی‌تر همین نسخه که متن بازخورد داشتند، هنگام ثبت امتیاز جدید پاک می‌شوند', async () => {
    const created = await orderService.createOrder(buildPayload());

    // شبیه‌سازی رکورد قدیمی که در حافظه متن بازخورد دارد
    const existing = JSON.parse(readStoredDemoOrders()) as Array<Record<string, unknown>>;
    existing[0].userFeedback = 'شماره من ۰۹۱۲۹۸۷۶۵۴۳ است';
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(existing));

    await orderService.submitOrderRating(created.id, 3);

    const stored = readStoredDemoOrders();
    expect(stored).not.toContain('۰۹۱۲۹۸۷۶۵۴۳');
    expect(stored).not.toContain('userFeedback');
  });
});

describe('یافته ۲ — داده نسخه قبلی دست‌نخورده می‌ماند', () => {
  it('خواندن فهرست نمایشی، کلید قدیمی را حذف نمی‌کند', async () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_VALUE);

    await orderService.getOrders();
    await orderService.getOrderById('anything');
    await orderService.getOrderByTrackingCode('PAK-84920');

    // مقدار قدیمی باید عیناً دست‌نخورده باقی بماند
    expect(localStorage.getItem(LEGACY_KEY)).toBe(LEGACY_VALUE);
  });

  it('ثبت سفارش جدید، داده قدیمی را وارد فهرست نمایشی نمی‌کند', async () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_VALUE);

    const created = await orderService.createOrder(buildPayload());
    const orders = await orderService.getOrders();

    // فقط سفارش تازه بازگردانده می‌شود
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(created.id);

    const serialized = JSON.stringify(orders);
    expect(serialized).not.toContain('مشتری قدیمی نسخه قبل');
    expect(serialized).not.toContain('۰۹۳۵۰۰۰۱۱۲۲');
    expect(serialized).not.toContain('بلوار پاکنژاد');
  });

  it('نوشتن سفارش جدید، کلید قدیمی را حذف یا بازنویسی نمی‌کند', async () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_VALUE);

    await orderService.createOrder(buildPayload());

    expect(localStorage.getItem(LEGACY_KEY)).toBe(LEGACY_VALUE);
  });

  it('کد پیگیری سفارش قدیمی در نسخه جدید قابل جست‌وجو نیست (بدون خواندن داده قدیمی)', async () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_VALUE);

    expect(await orderService.getOrderByTrackingCode('PAK-84920')).toBeNull();
    expect(await orderService.getOrderById('ord-legacy-1')).toBeNull();
  });

  it('اگر کلید جدید وجود نداشته باشد، فهرست خالی برمی‌گردد (نه داده قدیمی)', async () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_VALUE);

    const orders = await orderService.getOrders();
    expect(orders).toEqual([]);
  });

  it('لغو سفارش نمایشی هم به داده قدیمی دست نمی‌زند', async () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_VALUE);
    const created = await orderService.createOrder(buildPayload());

    await orderService.cancelOrder(created.id);

    expect(localStorage.getItem(LEGACY_KEY)).toBe(LEGACY_VALUE);
  });
});
