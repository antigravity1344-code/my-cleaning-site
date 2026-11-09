import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from './rateLimiter.js';

const makeReqRes = (ip = '1.2.3.4') => {
  const req = { ip };
  const res = {
    statusCode: undefined,
    headers: {},
    body: undefined,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
};

describe('createRateLimiter', () => {
  it('درخواست‌های زیر سقف را رد نمی‌کند', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const next = vi.fn();
    const { req, res } = makeReqRes();

    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBeUndefined();
  });

  it('بعد از عبور از سقف ۴۲۹ می‌دهد', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    const next = vi.fn();
    const { req, res } = makeReqRes();

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeDefined();
  });

  it('کلیدهای (IPهای) مختلف شمارندهٔ جدا دارند', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const next = vi.fn();
    const a = makeReqRes('1.1.1.1');
    const b = makeReqRes('2.2.2.2');

    limiter(a.req, a.res, next);
    limiter(b.req, b.res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(a.res.statusCode).toBeUndefined();
    expect(b.res.statusCode).toBeUndefined();
  });

  it('بعد از پایان پنجره دوباره اجازه می‌دهد', () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
      const next = vi.fn();
      const { req, res } = makeReqRes();

      limiter(req, res, next);
      limiter(req, res, next);
      expect(res.statusCode).toBe(429);

      vi.advanceTimersByTime(1001);
      const next2 = vi.fn();
      const res2 = makeReqRes().res;
      limiter(req, res2, next2);
      expect(next2).toHaveBeenCalledTimes(1);
      expect(res2.statusCode).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
