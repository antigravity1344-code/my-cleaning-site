import { describe, expect, it } from 'vitest';
import { CLEANERS_LIST, CUSTOMER_REVIEWS, SERVICES_LIST } from './mockData';
import * as mockData from './mockData';

/**
 * آزمون‌های تفکیک «داده نمونه» از «داده عملیاتی» و حذف اطلاعات شخصی انتشار‌یافته.
 */

describe('داده‌های نمونه — تفکیک و برچسب‌گذاری', () => {
  it('همه نظرات نمونه با recordType مشخص شده‌اند', () => {
    expect(CUSTOMER_REVIEWS.length).toBeGreaterThan(0);
    CUSTOMER_REVIEWS.forEach((review) => {
      expect(review.recordType).toBe('sample');
    });
  });

  it('هیچ نظر نمونه‌ای برچسب «سفارش احرازشده» نمی‌گیرد', () => {
    CUSTOMER_REVIEWS.forEach((review) => {
      expect(review.verifiedBooking).toBe(false);
    });
  });

  it('همه پروفایل‌های متخصص با recordType مشخص شده‌اند', () => {
    expect(CLEANERS_LIST.length).toBeGreaterThan(0);
    CLEANERS_LIST.forEach((cleaner) => {
      expect(cleaner.recordType).toBe('sample');
    });
  });

  it('کاتالوگ خدمات دست‌نخورده و کامل باقی مانده است (بدون حذف قابلیت)', () => {
    expect(SERVICES_LIST.length).toBeGreaterThanOrEqual(6);
    SERVICES_LIST.forEach((service) => {
      expect(service.baseHourlyRate).toBeGreaterThan(0);
      expect(service.minHours).toBeGreaterThan(0);
    });
  });
});

describe('اطلاعات شخصی منتشرشده در بسته تولیدی', () => {
  it('آرایه سفارش‌های از پیش پرشده (INITIAL_ORDERS) دیگر وجود ندارد', () => {
    expect('INITIAL_ORDERS' in mockData).toBe(false);
  });

  it('هیچ نام، شماره تماس یا نشانی مشتری ساختگی در داده‌های ماک باقی نمانده است', () => {
    const serialized = JSON.stringify(mockData);

    expect(serialized).not.toContain('سروش نیک‌پی');
    expect(serialized).not.toContain('۰۹۳۵۰۰۰۱۱۲۲');
    expect(serialized).not.toContain('بلوار پاکنژاد');
  });

  it('شماره تماس مشتری در فایل داده‌های ماک وجود ندارد', () => {
    const serialized = JSON.stringify(mockData);
    expect(serialized).not.toContain('customerPhone');
  });
});
