/**
 * کلاینت سرور پاکشو برای سایت مشتری.
 *
 * قرارداد (مطابق server/index.js پاکشو):
 *   - POST /api/pricing/quote  بدون ورود؛ پاسخ شامل quoteToken و total.
 *   - POST /api/auth/send-otp  شماره موبایل؛ کد پیامکی.
 *   - POST /api/auth/verify-otp  شماره + کد + role=CUSTOMER؛ پاسخ شامل token.
 *   - POST /api/orders  با توکن مشتری؛ باید quoteToken و confirmedTotal را داشته باشد.
 *   - GET  /api/track/:code  بدون ورود؛ فقط خلاصهٔ غیرشخصی.
 *
 * آدرس سرور از `VITE_PAKSHO_API_BASE` خوانده می‌شود. اگر تنظیم نشده باشد، کلاینت
 * هیچ درخواستی نمی‌فرستد و سایت در حالت نمایشی می‌ماند.
 */

const RAW_BASE = (import.meta.env.VITE_PAKSHO_API_BASE as string | undefined) ?? '';
const API_BASE = RAW_BASE.replace(/\/+$/, '');

export class PakshoApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'PakshoApiError';
    this.status = status;
    this.code = code;
  }
}

export function isPakshoConfigured(): boolean {
  return API_BASE !== '';
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
};

async function call<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE) {
    throw new PakshoApiError('سرور پاکشو تنظیم نشده است.', 0, 'NOT_CONFIGURED');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new PakshoApiError('ارتباط با سرور برقرار نشد.', 0, 'NETWORK');
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    code?: string;
  };
  if (!response.ok || payload.success === false) {
    throw new PakshoApiError(
      payload.message ?? 'خطایی در ارتباط با سرور رخ داد.',
      response.status,
      payload.code,
    );
  }
  return payload as T;
}

export interface PakshoQuote {
  quoteToken: string;
  total: number;
  currencyUnit: string;
  expiresAt: string;
}

export interface QuoteInput {
  serviceId: string;
  quantity: number;
  options?: Record<string, unknown>;
}

export async function requestQuote(input: QuoteInput): Promise<PakshoQuote> {
  const data = await call<{ quote: PakshoQuote }>('/api/pricing/quote', {
    method: 'POST',
    body: { serviceId: input.serviceId, quantity: input.quantity, options: input.options ?? {} },
  });
  return data.quote;
}

export async function sendOtp(phone: string): Promise<void> {
  await call('/api/auth/send-otp', { method: 'POST', body: { phone } });
}

export async function verifyOtp(phone: string, code: string): Promise<string> {
  const data = await call<{ token: string }>('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone, code, role: 'CUSTOMER' },
  });
  return data.token;
}

export interface PakshoOrderInput {
  serviceId: string;
  quantity: number;
  options?: Record<string, unknown>;
  quoteToken: string;
  confirmedTotal: number;
  address: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
  clientRequestId: string;
}

export interface PakshoOrderResult {
  id: string;
  status: string;
  price: number;
  serviceTitle: string;
  date: string;
  time: string;
}

export async function createOrder(token: string, input: PakshoOrderInput): Promise<PakshoOrderResult> {
  const data = await call<{ order: PakshoOrderResult }>('/api/orders', {
    method: 'POST',
    token,
    body: { ...input, options: input.options ?? {}, price: input.confirmedTotal },
  });
  return data.order;
}

export interface PublicOrderSummary {
  trackingCode: string;
  status: string;
  serviceTitle: string;
  date: string | null;
  time: string | null;
  area: string | null;
  createdAt: string | null;
}

export async function trackOrder(code: string): Promise<PublicOrderSummary | null> {
  try {
    const data = await call<{ order: PublicOrderSummary }>(`/api/track/${encodeURIComponent(code.trim())}`);
    return data.order;
  } catch (error) {
    if (error instanceof PakshoApiError && error.status === 404) return null;
    throw error;
  }
}
