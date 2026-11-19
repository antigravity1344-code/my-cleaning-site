import { describe, expect, it } from 'vitest';
import {
  normalizeIranMobile,
  isValidPhoneNumber,
  validateOrderContact,
  MIN_NAME_LENGTH,
  MIN_ADDRESS_LENGTH,
} from './orderContactValidation';

/**
 * این آزمون‌ها تصمیم فنی ۱۹ نوامبر ۲۰۲۶ را ثبت می‌کنند: قاعدهٔ شماره موبایل اینجا
 * باید دقیقاً با `normalizeIranMobile` سمت سرور پاکشو (server/kavenegarSms.js)
 * یکسان رفتار کند، نه سخت‌گیرتر و نه نرم‌تر.
 */
describe('normalizeIranMobile', () => {
  it('شمارهٔ ساده ۰۹xxxxxxxxx را بدون تغییر می‌پذیرد', () => {
    expect(normalizeIranMobile('09123456789')).toBe('09123456789');
  });

  it('فاصله، خط‌تیره و پرانتز را نادیده می‌گیرد', () => {
    expect(normalizeIranMobile('0912 345 6789')).toBe('09123456789');
    expect(normalizeIranMobile('0912-345-6789')).toBe('09123456789');
    expect(normalizeIranMobile('(0912) 345-6789')).toBe('09123456789');
  });

  it('پیشوند +98 را به 09 تبدیل می‌کند (دقیقاً مطابق normalizeIranMobile سرور)', () => {
    expect(normalizeIranMobile('+989123456789')).toBe('09123456789');
    expect(normalizeIranMobile('+98 912 345 6789')).toBe('09123456789');
  });

  it('پیشوند 0098 را رد می‌کند، چون سرور پاکشو هم این قالب را نمی‌پذیرد', () => {
    expect(normalizeIranMobile('00989123456789')).toBeNull();
  });

  it('شمارهٔ بدون صفر ابتدایی (9xxxxxxxxx) را می‌پذیرد', () => {
    expect(normalizeIranMobile('9123456789')).toBe('09123456789');
  });

  it('ارقام فارسی و عربی را می‌پذیرد', () => {
    expect(normalizeIranMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
  });

  it('شمارهٔ کوتاه یا نامعتبر را رد می‌کند', () => {
    expect(normalizeIranMobile('0912123456')).toBeNull();
    expect(normalizeIranMobile('۰۹۱۲۱۲۳۴۵۶')).toBeNull();
    expect(normalizeIranMobile('')).toBeNull();
  });
});

describe('isValidPhoneNumber', () => {
  it('برای قالب‌های پذیرفته‌شده true برمی‌گرداند', () => {
    expect(isValidPhoneNumber('0912 345 6789')).toBe(true);
    expect(isValidPhoneNumber('+98-912-345-6789')).toBe(true);
  });
  it('برای قالب نامعتبر false برمی‌گرداند', () => {
    expect(isValidPhoneNumber('123')).toBe(false);
  });
});

describe('validateOrderContact', () => {
  const base = { address: 'خیابان نمونه، پلاک ۱', name: 'کاربر آزمایشی', phone: '09123456789' };

  it('ورودی کامل و معتبر را می‌پذیرد و شمارهٔ نرمال‌شده را برمی‌گرداند', () => {
    const result = validateOrderContact(base);
    expect(result.valid).toBe(true);
    expect(result.normalizedPhone).toBe('09123456789');
  });

  it('شمارهٔ با فاصله و +98 را هم معتبر می‌شمارد', () => {
    const result = validateOrderContact({ ...base, phone: '+98 912 345 6789' });
    expect(result.valid).toBe(true);
    expect(result.normalizedPhone).toBe('09123456789');
  });

  it(`نام کوتاه‌تر از ${MIN_NAME_LENGTH} کاراکتر را رد می‌کند`, () => {
    const result = validateOrderContact({ ...base, name: 'ع' });
    expect(result.valid).toBe(false);
  });

  it(`آدرس کوتاه‌تر از ${MIN_ADDRESS_LENGTH} کاراکتر را رد می‌کند`, () => {
    const result = validateOrderContact({ ...base, address: 'تهران' });
    expect(result.valid).toBe(false);
  });

  it('فیلد خالی را رد می‌کند', () => {
    expect(validateOrderContact({ ...base, address: '' }).valid).toBe(false);
    expect(validateOrderContact({ ...base, name: '' }).valid).toBe(false);
    expect(validateOrderContact({ ...base, phone: '' }).valid).toBe(false);
  });
});
