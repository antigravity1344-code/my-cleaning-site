// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderTrackingShare } from './OrderTrackingShare';
import { buildDedicatedTrackUrl } from './trackingLink';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OrderTrackingShare', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
  });

  it('لینک اختصاصی همان سفارش را نشان می‌دهد و کپی می‌کند', async () => {
    const code = 'ORD-TEST-abcd1234';
    const expectedUrl = buildDedicatedTrackUrl(code)!;
    render(<OrderTrackingShare trackingCode={code} />);

    expect(screen.getByText(code)).toBeTruthy();
    expect(screen.getByRole('link', { name: expectedUrl }).getAttribute('href')).toBe(expectedUrl);

    fireEvent.click(screen.getByRole('button', { name: 'کپی لینک پیگیری' }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedUrl);
      expect(screen.getByRole('button', { name: 'لینک کپی شد' })).toBeTruthy();
    });
  });

  it('بدون کد ORD معتبر، پیام مناسب می‌دهد و دکمهٔ کپی ندارد', () => {
    render(<OrderTrackingShare trackingCode="   " />);
    expect(
      screen.getByText('کد رهگیری معتبر ORD برای این سفارش در دسترس نیست؛ لینک پیگیری ساخته نمی‌شود.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'کپی لینک پیگیری' })).toBeNull();
  });

  it('کد Crockford مستقل را لینک نمی‌کند', () => {
    render(<OrderTrackingShare trackingCode="ABCD-EFGH-JKMN-PQRS" />);
    expect(
      screen.getByText('کد رهگیری معتبر ORD برای این سفارش در دسترس نیست؛ لینک پیگیری ساخته نمی‌شود.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'کپی لینک پیگیری' })).toBeNull();
  });
});
