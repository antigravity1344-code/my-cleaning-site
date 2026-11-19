import { toLatinDigits } from '../services/pii';

/**
 * قاعدهٔ مشترک اعتبارسنجی اطلاعات تماس سفارش (آدرس، نام، شماره همراه).
 *
 * پیش از این همین قاعده مستقیماً داخل `BookingModal` نوشته شده بود. حالا تنها
 * منبع آن همین‌جاست، تا بعداً وقتی سرور همین قاعده را دوباره اعمال می‌کند
 * (طبق فرض ف۴ طرح عملیاتی)، هر دو طرف دقیقاً یک قاعده را بخوانند و از هم جدا
 * نیفتند.
 *
 * تصمیم فنی ۱۹ نوامبر ۲۰۲۶ (رفع ابهام‌های STATUS.md): قاعدهٔ شماره موبایل اینجا
 * عیناً با `normalizeIranMobile` سمت سرور پاکشو (server/kavenegarSms.js) هماهنگ شد:
 * فاصله، خط‌تیره، پرانتز و `+98` در ابتدای شماره پذیرفته می‌شوند، چون سرور
 * با همین قاعده نهایتاً شماره را می‌پذیرد یا رد می‌کند؛ رد کردن زودتر از آن سمت
 * سایت فقط UX را خراب می‌کرد. حداقل طول نام و آدرس هم برای جلوگیری از مقادیر
 * بی‌معنی (مثل یک حرف) اضافه شد.
 */

/** شماره باید ۱۱ رقمی و با 09 شروع شود؛ ارقام فارسی/عربی پیش از آزمون به لاتین تبدیل می‌شوند. */
export const PHONE_REGEX = /^09\d{9}$/;

/** حداقل طول قابل‌قبول نام و آدرس (پس از حذف فاصله‌های اضافه). */
export const MIN_NAME_LENGTH = 3;
export const MIN_ADDRESS_LENGTH = 10;

export const normalizePhoneDigits = (phone: string): string => toLatinDigits(phone.trim());

/**
 * شماره را به قالب ۰۹xxxxxxxxx نرمال می‌کند، دقیقاً همان‌طور که سرور پاکشو
 * (`normalizeIranMobile`) انجام می‌دهد: فاصله/خط‌تیره/پرانتز حذف می‌شوند و
 * پیشوند `+98` یا نبودِ صفر ابتدایی (`9xxxxxxxxx`) پذیرفته می‌شود؛ `0098` پذیرفته نمی‌شود چون سرور هم آن را رد می‌کند.
 * اگر شماره به هیچ‌کدام از این قالب‌ها نخورد، `null` برمی‌گردد.
 */
export const normalizeIranMobile = (phone: string): string | null => {
  const latin = toLatinDigits(phone);
  const digits = latin.replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^989\d{9}$/.test(digits)) return '0' + digits.slice(2);
  if (/^9\d{9}$/.test(digits)) return '0' + digits;
  return null;
};

export const isValidPhoneNumber = (phone: string): boolean => normalizeIranMobile(phone) !== null;

export interface OrderContactInput {
  address: string;
  name: string;
  phone: string;
}

export interface OrderContactValidationResult {
  valid: boolean;
  /** فقط وقتی valid=false مقدار دارد؛ متن آماده برای نمایش به کاربر. */
  errorMessage?: string;
  /** فقط وقتی valid=true مقدار دارد؛ شماره نرمال‌شدهٔ ۰۹xxxxxxxxx آماده برای ارسال به سرور. */
  normalizedPhone?: string;
}

export const validateOrderContact = ({ address, name, phone }: OrderContactInput): OrderContactValidationResult => {
  const trimmedAddress = address.trim();
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  if (!trimmedAddress || !trimmedName || !trimmedPhone) {
    return { valid: false, errorMessage: 'لطفاً آدرس دقیق، نام و شماره همراه را تکمیل فرمایید.' };
  }
  if (trimmedName.length < MIN_NAME_LENGTH) {
    return { valid: false, errorMessage: 'لطفاً نام کامل خود را وارد کنید.' };
  }
  if (trimmedAddress.length < MIN_ADDRESS_LENGTH) {
    return { valid: false, errorMessage: 'لطفاً آدرس را کامل‌تر بنویسید (محله، خیابان و پلاک).' };
  }
  const normalizedPhone = normalizeIranMobile(trimmedPhone);
  if (!normalizedPhone) {
    return {
      valid: false,
      errorMessage: 'لطفاً شماره همراه معتبر (مثال: 09123456789 یا +98 912 345 6789) وارد کنید.',
    };
  }
  return { valid: true, normalizedPhone };
};
