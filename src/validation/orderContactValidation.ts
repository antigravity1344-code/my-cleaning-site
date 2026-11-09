import { toLatinDigits } from '../services/pii';

/**
 * قاعدهٔ مشترک اعتبارسنجی اطلاعات تماس سفارش (آدرس، نام، شماره همراه).
 *
 * پیش از این همین قاعده مستقیماً داخل `BookingModal` نوشته شده بود. حالا تنها
 * منبع آن همین‌جاست، تا بعداً وقتی سرور همین قاعده را دوباره اعمال می‌کند
 * (طبق فرض ف۴ طرح عملیاتی)، هر دو طرف دقیقاً یک قاعده را بخوانند و از هم جدا
 * نیفتند. رفتار و متن پیام‌ها نسبت به قبل تغییر نکرده است.
 */

/** شماره باید ۱۱ رقمی و با 09 شروع شود؛ ارقام فارسی/عربی پیش از آزمون به لاتین تبدیل می‌شوند. */
export const PHONE_REGEX = /^09\d{9}$/;

export const normalizePhoneDigits = (phone: string): string => toLatinDigits(phone.trim());

export const isValidPhoneNumber = (phone: string): boolean => PHONE_REGEX.test(normalizePhoneDigits(phone));

export interface OrderContactInput {
  address: string;
  name: string;
  phone: string;
}

export interface OrderContactValidationResult {
  valid: boolean;
  /** فقط وقتی valid=false مقدار دارد؛ متن آماده برای نمایش به کاربر. */
  errorMessage?: string;
}

export const validateOrderContact = ({ address, name, phone }: OrderContactInput): OrderContactValidationResult => {
  if (!address.trim() || !name.trim() || !phone.trim()) {
    return { valid: false, errorMessage: 'لطفاً آدرس دقیق، نام و شماره همراه را تکمیل فرمایید.' };
  }
  if (!isValidPhoneNumber(phone)) {
    return {
      valid: false,
      errorMessage: 'لطفاً شماره همراه معتبر ۱۱ رقمی (مثال: 09123456789) وارد کنید.',
    };
  }
  return { valid: true };
};
