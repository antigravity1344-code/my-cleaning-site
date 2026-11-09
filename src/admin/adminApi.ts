/**
 * کلاینت API پنل مدیر — سند عملیاتی، بخش ۶ و ۱۵ (PR#4).
 *
 * `credentials: 'include'` لازم است تا کوکی نشست HttpOnly در هر درخواست
 * فرستاده شود. CSRF از طریق هدر `X-CSRF-Token` (نه بدنه) فرستاده می‌شود —
 * مقدارش فقط در حافظهٔ جاوااسکریپت صفحه نگه داشته می‌شود، نه در
 * localStorage (با رفرش صفحه با GET /api/admin/session دوباره گرفته می‌شود).
 */

export interface AdminOrderSummary {
  id: string;
  trackingCode: string;
  status: string;
  statusUpdatedAt: string;
  serviceTitle: string;
  hours: number;
  cityName: string | null;
  customerName: string;
  customerPhone: string;
  total: number;
  createdAt: string;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  serviceId: string;
  addonIds: string[];
  hasDetergentPackage: boolean;
  promoCode: string | null;
  date: string | null;
  timeSlot: string | null;
  district: string | null;
  address: string;
  unit: string | null;
  notes: string | null;
  pricingVersion: string;
  serviceBase: number;
  addonsTotal: number;
  detergentCost: number;
  discountTotal: number;
  paymentMethod: string;
  updatedAt: string;
}

export interface AdminOrderEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actor: string;
  note: string | null;
  createdAt: string;
}

export class AdminApiError extends Error {
  status: number;
  field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  // توجه: `...options` باید قبل از `headers` بیاید؛ وگرنه options.headers
  // کل شیء headers (و content-type پیش‌فرض) را به‌جای ادغام‌شدن، می‌پوشاند.
  const res = await fetch(`/api/admin${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    let message = 'خطایی رخ داد.';
    let field: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.message === 'string') message = body.message;
      if (typeof body?.field === 'string') field = body.field;
    } catch {
      // بدنهٔ خطا JSON نبود؛ پیام پیش‌فرض باقی می‌ماند.
    }
    throw new AdminApiError(res.status, message, field);
  }
  return (await res.json()) as T;
};

export const adminLogin = (username: string, password: string, totp: string) =>
  request<{ csrfToken: string; username: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, totp }),
  });

export const adminLogout = (csrfToken: string) =>
  request<{ ok: true }>('/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });

/** بعد از رفرش صفحه: اگر کوکی نشست هنوز معتبر باشد، csrfToken تازه می‌دهد. */
export const fetchAdminSession = () => request<{ csrfToken: string }>('/session');

export const fetchAdminOrders = () => request<{ orders: AdminOrderSummary[] }>('/orders');

export const fetchAdminOrderDetail = (id: string) =>
  request<{ order: AdminOrderDetail; events: AdminOrderEvent[] }>(`/orders/${id}`);

export const changeAdminOrderStatus = (id: string, csrfToken: string, status: string, note?: string) =>
  request<{ order: AdminOrderDetail; events: AdminOrderEvent[] }>(`/orders/${id}`, {
    method: 'PATCH',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ status, note }),
  });
