import { describe, expect, it } from 'vitest';
import { PUBLIC_TRACK_PAGE_URL, buildDedicatedTrackUrl, usableTrackingCode } from './trackingLink';

describe('usableTrackingCode', () => {
  it('کد را بدون ساختگی برمی‌گرداند', () => {
    expect(usableTrackingCode('  ORD-TEST-abcd1234  ')).toBe('ORD-TEST-abcd1234');
    expect(usableTrackingCode('')).toBeNull();
    expect(usableTrackingCode(null)).toBeNull();
  });
});

describe('buildDedicatedTrackUrl (نسخه متصل — فقط ORD)', () => {
  it('لینک اختصاصی ORD را با encode درست می‌سازد', () => {
    expect(buildDedicatedTrackUrl('ORD-TEST-abcd1234')).toBe(
      'https://pakshu.ir/track/ORD-TEST-abcd1234',
    );
    expect(buildDedicatedTrackUrl('ord-test-ABCD1234')).toBe(
      `${PUBLIC_TRACK_PAGE_URL}/${encodeURIComponent('ORD-TEST-abcd1234')}`,
    );
  });

  it('کد Crockford مستقل و ورودی نامعتبر را لینک نمی‌کند', () => {
    expect(buildDedicatedTrackUrl('')).toBeNull();
    expect(buildDedicatedTrackUrl(null)).toBeNull();
    expect(buildDedicatedTrackUrl('ABCD-EFGH-JKMN-PQRS')).toBeNull();
    expect(buildDedicatedTrackUrl('not-a-real-code')).toBeNull();
  });
});
