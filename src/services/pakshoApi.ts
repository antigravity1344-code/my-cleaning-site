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
  readonly retryAfter: string | null;

  constructor(message: string, status: number, code?: string, retryAfter: string | null = null) {
    super(message);
    this.name = 'PakshoApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
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
      response.status === 429 ? response.headers?.get('Retry-After') ?? null : null,
    );
  }
  return payload as T;
}

export interface PakshoLine {
  id: string;
  amount: number;
}

export interface PakshoQuote {
  quoteToken: string;
  subtotal: number;
  surcharges: PakshoLine[];
  discounts: PakshoLine[];
  total: number;
  currencyUnit: string;
  expiresAt: string;
}

export interface QuoteInput {
  serviceId: string;
  quantity: number;
  options?: Record<string, unknown>;
  discountCode?: string;
}

const serviceIds = new Map([
  ['home-standard', 'home_unit_cleaning'],
  ['home-deep', 'home_unit_cleaning'],
  ['office', 'office_company_cleaning'],
  ['building-staircase', 'staircase_common_areas'],
  ['furniture-carpet', 'sofa_carpet_washing'],
]);

export function pakshoServiceId(serviceId: string): string {
  return serviceIds.get(serviceId) ?? serviceId;
}

const pendingQuotes = new Map<string, Promise<PakshoQuote>>();

export function requestQuote(input: QuoteInput): Promise<PakshoQuote> {
  const body = {
    serviceId: pakshoServiceId(input.serviceId),
    quantity: input.quantity,
    options: input.options ?? {},
    ...(input.discountCode ? { discountCode: input.discountCode } : {}),
  };
  const key = JSON.stringify(body);
  const pending = pendingQuotes.get(key);
  if (pending) return pending;
  const quote = call<{ quote: PakshoQuote }>('/api/pricing/quote', { method: 'POST', body })
    .then(data => data.quote)
    .finally(() => { pendingQuotes.delete(key); });
  pendingQuotes.set(key, quote);
  return quote;
}

export interface PricingRule {
  serviceId: string;
  model: 'hourly' | 'fixed' | 'count' | 'area';
}

let pendingPricingRules: Promise<PricingRule[]> | undefined;

export function getPricingRules(): Promise<PricingRule[]> {
  pendingPricingRules ??= call<{ pricingRules: PricingRule[] }>('/api/services/enabled')
    .then(data => data.pricingRules ?? [])
    .finally(() => { pendingPricingRules = undefined; });
  return pendingPricingRules;
}

export interface SiteFeatures {
  siteExtras: boolean;
  detergentPackage: boolean;
}

/** کلیدهای سایت (بدون ورود): آیا افزودنی/کد تخفیف و پکیج شوینده روشن‌اند. */
export async function getSiteFeatures(): Promise<SiteFeatures> {
  const data = await call<SiteFeatures>('/api/site/features');
  return { siteExtras: data.siteExtras === true, detergentPackage: data.detergentPackage === true };
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
  discountCode?: string;
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
    body: { ...input, serviceId: pakshoServiceId(input.serviceId), options: input.options ?? {}, price: input.confirmedTotal },
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
