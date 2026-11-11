import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  AdminOrderDetail,
  AdminOrderEvent,
  AdminOrderSummary,
  changeAdminOrderStatus,
  fetchAdminOrderDetail,
  fetchAdminOrders,
} from './adminApi';
import { ALLOWED_STATUS_TRANSITIONS, STATUS_BADGE_CLASS, STATUS_LABELS } from './statusMap';

interface OrdersViewProps {
  csrfToken: string;
}

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status] ?? 'admin-neutral'}`}>
    {STATUS_LABELS[status] ?? status}
  </span>
);

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });

export function OrdersView({ csrfToken }: OrdersViewProps) {
  const [orders, setOrders] = useState<AdminOrderSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const { orders: list } = await fetchAdminOrders();
      setOrders(list);
    } catch (err) {
      setListError(err instanceof AdminApiError ? err.message : 'فهرست سفارش‌ها بارگذاری نشد.');
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="admin-card min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
          <h2 className="admin-label font-bold">سفارش‌ها {orders && <bdi className="admin-count">({orders.length === 0 ? <span className="admin-zero">۰</span> : orders.length.toLocaleString('fa-IR')})</bdi>}</h2>
          <button
            type="button"
            onClick={loadOrders}
            className="admin-button"
          >
            تازه‌سازی
          </button>
        </div>
        {listError && <p className="px-4 py-3 admin-error rounded-xl p-2 text-sm">{listError}</p>}
        {!listError && orders === null && <p className="px-4 py-3 text-sm text-slate-500">در حال بارگذاری...</p>}
        {orders !== null && orders.length === 0 && (
          <p className="px-4 py-3 text-sm text-slate-500">هنوز سفارشی ثبت نشده است.</p>
        )}
        <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
          {orders?.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => setSelectedId(order.id)}
                className={`admin-order w-full p-4 text-right ${selectedId === order.id ? 'admin-order-active' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{order.customerName}</span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 admin-label">
                  <span>{order.serviceTitle} · {order.hours} ساعت</span>
                  <span className="font-mono">{order.total.toLocaleString('fa-IR')} ت</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{formatDateTime(order.createdAt)}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-card min-w-0 p-4">
        {selectedId ? (
          <OrderDetailPanel
            orderId={selectedId}
            csrfToken={csrfToken}
            onStatusChanged={loadOrders}
          />
        ) : (
          <p className="text-sm text-slate-500">یک سفارش از فهرست را برای مشاهدهٔ جزئیات انتخاب کنید.</p>
        )}
      </div>
    </div>
  );
}

interface OrderDetailPanelProps {
  orderId: string;
  csrfToken: string;
  onStatusChanged: () => void;
}

function OrderDetailPanel({ orderId, csrfToken, onStatusChanged }: OrderDetailPanelProps) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [events, setEvents] = useState<AdminOrderEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchAdminOrderDetail(orderId);
      setOrder(result.order);
      setEvents(result.events);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'جزئیات سفارش بارگذاری نشد.');
    }
  }, [orderId]);

  useEffect(() => {
    setOrder(null);
    setNote('');
    load();
  }, [load]);

  const handleStatusChange = async (nextStatus: string) => {
    setUpdating(nextStatus);
    setError(null);
    try {
      const result = await changeAdminOrderStatus(orderId, csrfToken, nextStatus, note.trim() || undefined);
      setOrder(result.order);
      setEvents(result.events);
      setNote('');
      onStatusChanged();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'تغییر وضعیت ذخیره نشد.');
    } finally {
      setUpdating(null);
    }
  };

  if (error && !order) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }
  if (!order) {
    return <p className="text-sm text-slate-500">در حال بارگذاری...</p>;
  }

  const nextStatuses = ALLOWED_STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">{order.customerName}</h3>
          <p className="font-mono text-xs text-slate-500">{order.trackingCode}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">تلفن</dt>
        <dd className="font-mono">{order.customerPhone}</dd>
        <dt className="text-slate-500">آدرس</dt>
        <dd>{order.address}{order.unit ? `، ${order.unit}` : ''}</dd>
        <dt className="text-slate-500">شهر / منطقه</dt>
        <dd>{order.cityName ?? '—'}{order.district ? `، ${order.district}` : ''}</dd>
        <dt className="text-slate-500">خدمت</dt>
        <dd>{order.serviceTitle} · {order.hours} ساعت</dd>
        <dt className="text-slate-500">تاریخ / بازه</dt>
        <dd>{order.date ?? '—'} {order.timeSlot ?? ''}</dd>
        <dt className="text-slate-500">مبلغ کل</dt>
        <dd className="font-mono">{order.total.toLocaleString('fa-IR')} تومان</dd>
        {order.notes && (
          <>
            <dt className="text-slate-500">توضیحات مشتری</dt>
            <dd>{order.notes}</dd>
          </>
        )}
      </dl>

      <div className="admin-neutral rounded-2xl p-4">
        <h4 className="mb-2 text-xs font-bold text-slate-700">تاریخچهٔ وضعیت</h4>
        <ul className="space-y-1.5 text-xs text-slate-600">
          {events.map((event) => (
            <li key={event.id}>
              {event.fromStatus ? `${STATUS_LABELS[event.fromStatus] ?? event.fromStatus} ← ` : ''}
              {STATUS_LABELS[event.toStatus] ?? event.toStatus}
              <span className="text-slate-400"> · {formatDateTime(event.createdAt)}</span>
              {event.note && <div className="text-slate-500">یادداشت: {event.note}</div>}
            </li>
          ))}
        </ul>
      </div>

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      {nextStatuses.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="block space-y-1">
            <span className="admin-label font-medium">یادداشت داخلی (اختیاری)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="admin-field w-full"
            />
          </label>
          <div className="admin-actions">
            {nextStatuses.map((status) => (
              <button
                key={status}
                type="button"
                disabled={updating !== null}
                onClick={() => handleStatusChange(status)}
                className="admin-button"
              >
                {updating === status ? 'در حال ثبت...' : `تغییر به «${STATUS_LABELS[status] ?? status}»`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
