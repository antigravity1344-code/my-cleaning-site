import { describe, expect, it } from 'vitest';
import {
  PAKSHO_TRACKING_CODE_PATTERN,
  STANDALONE_TRACKING_CODE_PATTERN,
  isAcceptedTrackingCode,
  normalizeTrackingCode,
} from './trackingCodeFormat';

/** نمونه‌های هم‌شکل خروجی واقعی generateTrackingCode مستقل (نباید در نسخهٔ متصل پذیرفته شوند). */
const STANDALONE_SAMPLES = [
  'ABCD-EFGH-JKMN-PQRS',
  '0123-4567-89AB-CDEF',
  'ZZZZ-YYYY-XXXX-WWWW',
  'A1B2-C3D4-E5F6-G7H8',
] as const;

describe('normalizeTrackingCode', () => {
  it('کد پاکشو را با هگز پایانی کوچک نرمال می‌کند', () => {
    expect(normalizeTrackingCode('ord-mwkotxcm-230E612F')).toBe('ORD-MWKOTXCM-230e612f');
  });
});

describe('isAcceptedTrackingCode (نسخه متصل — فقط ORD)', () => {
  it('کد ORD معتبر را می‌پذیرد', () => {
    expect(isAcceptedTrackingCode('ORD-TEST-abcd1234')).toBe(true);
    const normalized = normalizeTrackingCode('ORD-ABC-0123ABCD');
    expect(PAKSHO_TRACKING_CODE_PATTERN.test(normalized)).toBe(true);
    expect(isAcceptedTrackingCode(normalized)).toBe(true);
  });

  it('کد Crockford مستقل را رد می‌کند حتی اگر شکل generateTrackingCode باشد', () => {
    for (const sample of STANDALONE_SAMPLES) {
      expect(STANDALONE_TRACKING_CODE_PATTERN.test(sample)).toBe(true);
      expect(isAcceptedTrackingCode(normalizeTrackingCode(sample))).toBe(false);
    }
  });

  it('ورودی دلخواه و ناامن را رد می‌کند', () => {
    expect(isAcceptedTrackingCode(normalizeTrackingCode('not-a-real-code'))).toBe(false);
    expect(isAcceptedTrackingCode(normalizeTrackingCode('ORD-BAD'))).toBe(false);
    expect(isAcceptedTrackingCode(normalizeTrackingCode('../etc/passwd'))).toBe(false);
    expect(isAcceptedTrackingCode(normalizeTrackingCode('A'.repeat(200)))).toBe(false);
  });
});
