// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('capabilities', () => {
  it('بدون آدرس سرور در حالت نمایشی می‌ماند', async () => {
    vi.stubEnv('VITE_PAKSHO_API_BASE', '');
    vi.resetModules();
    const mod = await import('./capabilities');
    expect(mod.DEMO_MODE).toBe(true);
    expect(mod.SERVER_SIDE_PRICING_AVAILABLE).toBe(false);
    expect(mod.DEMO_COPY.badge).toBe('نسخه آزمایشی');
  });

  it('با آدرس سرور پاکشو حالت واقعی می‌شود', async () => {
    vi.stubEnv('VITE_PAKSHO_API_BASE', 'https://pakshu.ir');
    vi.resetModules();
    const mod = await import('./capabilities');
    expect(mod.DEMO_MODE).toBe(false);
    expect(mod.SERVER_SIDE_PRICING_AVAILABLE).toBe(true);
    expect(mod.NOTIFICATIONS_AVAILABLE).toBe(true);
    expect(mod.ONLINE_PAYMENT_AVAILABLE).toBe(false);
    expect(mod.DEMO_COPY.successTitle).toBe('درخواست شما ثبت شد');
  });
});
