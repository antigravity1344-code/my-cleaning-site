import { describe, expect, it } from 'vitest';
import { isPublicTrackPath, parseTrackPath } from './trackRoute';

describe('isPublicTrackPath', () => {
  it('مسیر پایه و مسیر با کد را تشخیص می‌دهد', () => {
    expect(isPublicTrackPath('/track')).toBe(true);
    expect(isPublicTrackPath('/track/')).toBe(true);
    expect(isPublicTrackPath('/track/ORD-TEST-abcd1234')).toBe(true);
    expect(isPublicTrackPath('/track/ORD-TEST-abcd1234/')).toBe(true);
    expect(isPublicTrackPath('/admin')).toBe(false);
    expect(isPublicTrackPath('/')).toBe(false);
  });
});

describe('parseTrackPath', () => {
  it('مسیر پایه را بدون کد برمی‌گرداند', () => {
    expect(parseTrackPath('/track')).toEqual({ kind: 'base' });
    expect(parseTrackPath('/track/')).toEqual({ kind: 'base' });
  });

  it('کد را از مسیر decode می‌کند', () => {
    expect(parseTrackPath('/track/ORD-TEST-abcd1234')).toEqual({
      kind: 'code',
      raw: 'ORD-TEST-abcd1234',
    });
    expect(parseTrackPath('/track/' + encodeURIComponent('ORD-TEST-abcd1234'))).toEqual({
      kind: 'code',
      raw: 'ORD-TEST-abcd1234',
    });
  });

  it('مسیر تو در تو یا بخش خالی را نامعتبر می‌داند', () => {
    expect(parseTrackPath('/track/a/b')).toEqual({ kind: 'invalid' });
    expect(parseTrackPath('/track/%E0%A4%A')).toEqual({ kind: 'invalid' });
  });
});
