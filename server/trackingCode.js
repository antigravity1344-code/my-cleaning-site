import { randomBytes } from 'node:crypto';

/**
 * کد پیگیری سفارش — سند عملیاتی، بخش ۷.
 *
 * - حداقل ۸۰ بیت، با مولد تصادفی رمزنگاری‌شده (نه Math.random).
 * - الفبای Crockford Base32 (بدون نویسه‌های مبهم I, L, O, U).
 * - ۱۶ نویسه در ۴ گروهِ ۴تایی با خط تیره، بدون هیچ ارتباطی با شماره، زمان یا ترتیب.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 نویسه، بدون I, L, O, U

export const generateTrackingCode = () => {
  const bytes = randomBytes(10); // 80 بیت
  let bits = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let code = '';
  for (let i = 0; i < 80; i += 5) {
    const chunk = bits.slice(i, i + 5);
    code += ALPHABET[parseInt(chunk, 2)];
  }
  return code.match(/.{1,4}/g).join('-');
};
