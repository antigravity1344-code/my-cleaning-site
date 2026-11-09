import { randomUUID, createHash } from 'node:crypto';
import { calculateServerPrice, validateQuoteInput, QuoteValidationError } from './pricingEngine.js';
import { generateTrackingCode } from './trackingCode.js';

/** سند عملیاتی، بخش ۳: چهار وضعیت و تغییرهای مجاز (فقط مدیر، فقط رو به جلو). */
export const ALLOWED_STATUS_TRANSITIONS = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/**
 * بک‌اند «حالت مستقل» — سند عملیاتی، ف۷.
 *
 * این یکی از دو پیاده‌سازی ممکنِ «بک‌اندِ سفارش» است. پیاده‌سازی «حالت هماهنگ»
 * (اتصال به بک‌اند اپ موبایل پاکشو) هنوز ساخته نشده — طراحی‌اش به تصمیم‌های
 * جداگانه‌ای نیاز دارد (مستند در OPERATIONAL-PLAN.md، بخش ۱۱، تصمیم ۱).
 * انتخاب بین این دو با متغیر محیطی `BACKEND_MODE` در `server/index.js` انجام
 * می‌شود؛ فعلاً فقط مقدار `standalone` پیاده‌سازی شده است.
 */

const hashRequestBody = (body) => createHash('sha256').update(JSON.stringify(body)).digest('hex');

export const createStandaloneBackend = (db) => {
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, tracking_code, status, status_updated_at,
      service_id, service_title, hours, addon_ids_json, has_detergent_package, promo_code,
      date, time_slot, city_name, district, address, unit, customer_name, customer_phone, notes,
      pricing_version, service_base, addons_total, detergent_cost, discount_total, total,
      payment_method, idempotency_key, request_hash, created_at, updated_at
    ) VALUES (
      @id, @trackingCode, @status, @statusUpdatedAt,
      @serviceId, @serviceTitle, @hours, @addonIdsJson, @hasDetergentPackage, @promoCode,
      @date, @timeSlot, @cityName, @district, @address, @unit, @customerName, @customerPhone, @notes,
      @pricingVersion, @serviceBase, @addonsTotal, @detergentCost, @discountTotal, @total,
      @paymentMethod, @idempotencyKey, @requestHash, @createdAt, @updatedAt
    )
  `);

  const insertEvent = db.prepare(`
    INSERT INTO order_events (id, order_id, from_status, to_status, actor, note, created_at)
    VALUES (@id, @orderId, @fromStatus, @toStatus, @actor, @note, @createdAt)
  `);

  const findByIdempotencyKey = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?');
  const findByTrackingCode = db.prepare('SELECT * FROM orders WHERE tracking_code = ?');
  const findById = db.prepare('SELECT * FROM orders WHERE id = ?');
  const listAllOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
  const listOrderEvents = db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC');
  const updateOrderStatus = db.prepare('UPDATE orders SET status = @status, status_updated_at = @statusUpdatedAt, updated_at = @updatedAt WHERE id = @id');

  const toPublicOrder = (row) => ({
    trackingCode: row.tracking_code,
    status: row.status,
    serviceId: row.service_id,
    serviceTitle: row.service_title,
    hours: row.hours,
    total: row.total,
    createdAt: row.created_at,
  });

  /** پیش‌فاکتور: POST /api/quotes — هیچ‌چیز ذخیره نمی‌شود، فقط مبلغ معتبر محاسبه می‌شود. */
  const createQuote = (rawInput) => {
    const validated = validateQuoteInput(rawInput);
    return calculateServerPrice(validated);
  };

  /**
   * ثبت سفارش: POST /api/orders — طبق سند عملیاتی بخش ۵ (جلوگیری از ثبت تکراری).
   * - کلید یکسان + محتوای یکسان → همان سفارش برمی‌گردد (idempotent: true).
   * - کلید یکسان + محتوای متفاوت → QuoteValidationError با field='idempotencyKey' (۴۰۹ در لایهٔ HTTP).
   */
  const createOrder = (rawInput, idempotencyKey) => {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8) {
      throw new QuoteValidationError('idempotencyKey', 'سرآیند Idempotency-Key لازم و باید یکتا باشد.');
    }

    const requestHash = hashRequestBody(rawInput);
    const existing = findByIdempotencyKey.get(idempotencyKey);
    if (existing) {
      if (existing.request_hash !== requestHash) {
        const error = new QuoteValidationError('idempotencyKey', 'این کلید قبلاً با محتوای دیگری استفاده شده است.');
        error.statusCode = 409;
        throw error;
      }
      return { order: toPublicOrder(existing), idempotent: true };
    }

    const validated = validateQuoteInput(rawInput);
    const priced = calculateServerPrice(validated);

    const { address, customerName, customerPhone } = rawInput;
    if (
      typeof address !== 'string' || !address.trim() ||
      typeof customerName !== 'string' || !customerName.trim() ||
      typeof customerPhone !== 'string'
    ) {
      throw new QuoteValidationError('address', 'آدرس، نام و شماره همراه لازم‌اند.');
    }

    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      trackingCode: generateTrackingCode(),
      status: 'new',
      statusUpdatedAt: now,
      serviceId: priced.serviceId,
      serviceTitle: priced.serviceTitle,
      hours: priced.hours,
      addonIdsJson: JSON.stringify(validated.addonIds),
      hasDetergentPackage: validated.hasDetergentPackage ? 1 : 0,
      promoCode: validated.promoCode ?? null,
      date: typeof rawInput.date === 'string' ? rawInput.date : null,
      timeSlot: typeof rawInput.timeSlot === 'string' ? rawInput.timeSlot : null,
      cityName: typeof rawInput.cityName === 'string' ? rawInput.cityName : null,
      district: typeof rawInput.district === 'string' ? rawInput.district : null,
      address: address.trim(),
      unit: typeof rawInput.unit === 'string' ? rawInput.unit : null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      notes: typeof rawInput.notes === 'string' ? rawInput.notes : null,
      pricingVersion: priced.pricingVersion,
      serviceBase: priced.serviceBase,
      addonsTotal: priced.addonsTotal,
      detergentCost: priced.detergentCost,
      discountTotal: priced.discountsTotal,
      total: priced.total,
      paymentMethod: 'cash_on_site',
      idempotencyKey,
      requestHash,
      createdAt: now,
      updatedAt: now,
    };

    insertOrder.run(row);
    insertEvent.run({
      id: randomUUID(),
      orderId: row.id,
      fromStatus: null,
      toStatus: 'new',
      actor: 'system',
      note: null,
      createdAt: now,
    });

    return { order: toPublicOrder({ ...row, tracking_code: row.trackingCode, status: row.status, service_id: row.serviceId, service_title: row.serviceTitle, created_at: row.createdAt }), idempotent: false };
  };

  /**
   * پیگیری سفارش با کد: GET /api/track/:code — سند عملیاتی بخش ۷.
   * خروجی عمداً محدود است: فقط خدمت، تاریخ/بازه، شهر، وضعیت و زمان آخرین
   * تغییر. نام، آدرس و تلفن هرگز در این پاسخ نیستند. کد ناموجود یا نامعتبر
   * هر دو null برمی‌گردانند تا لایهٔ HTTP پاسخ یکسان بدهد (حدس‌زنی را سخت‌تر می‌کند).
   */
  const trackOrder = (trackingCode) => {
    if (typeof trackingCode !== 'string' || !trackingCode.trim()) return null;
    const row = findByTrackingCode.get(trackingCode.trim().toUpperCase());
    if (!row) return null;
    return {
      serviceTitle: row.service_title,
      date: row.date,
      timeSlot: row.time_slot,
      cityName: row.city_name,
      status: row.status,
      statusUpdatedAt: row.status_updated_at,
    };
  };

  /**
   * نمای کامل سفارش برای پنل مدیر — سند عملیاتی بخش ۶: اطلاعات شخصی فقط اینجا
   * دیده می‌شود (نه در پاسخ پیگیری مشتری).
   */
  const toAdminOrder = (row) => ({
    id: row.id,
    trackingCode: row.tracking_code,
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    serviceId: row.service_id,
    serviceTitle: row.service_title,
    hours: row.hours,
    addonIds: JSON.parse(row.addon_ids_json),
    hasDetergentPackage: Boolean(row.has_detergent_package),
    promoCode: row.promo_code,
    date: row.date,
    timeSlot: row.time_slot,
    cityName: row.city_name,
    district: row.district,
    address: row.address,
    unit: row.unit,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    notes: row.notes,
    pricingVersion: row.pricing_version,
    serviceBase: row.service_base,
    addonsTotal: row.addons_total,
    detergentCost: row.detergent_cost,
    discountTotal: row.discount_total,
    total: row.total,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const toAdminEvent = (row) => ({
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actor: row.actor,
    note: row.note,
    createdAt: row.created_at,
  });

  const listOrdersForAdmin = () => listAllOrders.all().map(toAdminOrder);

  const getOrderForAdmin = (orderId) => {
    const row = findById.get(orderId);
    if (!row) return null;
    return { order: toAdminOrder(row), events: listOrderEvents.all(orderId).map(toAdminEvent) };
  };

  /**
   * تغییر وضعیت توسط مدیر — فقط گذارهای مجاز (ALLOWED_STATUS_TRANSITIONS).
   * یک رخداد در order_events (افزودنی) ثبت می‌کند.
   */
  const changeOrderStatus = (orderId, { toStatus, note, actor = 'admin' } = {}) => {
    const row = findById.get(orderId);
    if (!row) {
      const error = new QuoteValidationError('orderId', 'سفارش پیدا نشد.');
      error.statusCode = 404;
      throw error;
    }
    const allowed = ALLOWED_STATUS_TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new QuoteValidationError(
        'status',
        `تغییر وضعیت از «${row.status}» به «${toStatus}» مجاز نیست.`
      );
    }

    const now = new Date().toISOString();
    updateOrderStatus.run({ id: orderId, status: toStatus, statusUpdatedAt: now, updatedAt: now });
    insertEvent.run({
      id: randomUUID(),
      orderId,
      fromStatus: row.status,
      toStatus,
      actor,
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
      createdAt: now,
    });

    return getOrderForAdmin(orderId);
  };

  return {
    createQuote,
    createOrder,
    trackOrder,
    listOrdersForAdmin,
    getOrderForAdmin,
    changeOrderStatus,
  };
};
