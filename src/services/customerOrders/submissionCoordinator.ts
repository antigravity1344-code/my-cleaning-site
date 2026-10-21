import {
  isUncertainSubmitOutcome,
  OrderGatewayError,
  pickOrderRequest,
  type CustomerOrderGateway,
  type OrderReceipt,
  type OrderRequest,
} from './contract';
import { createIdempotencyKey } from './idempotency';

/**
 * هماهنگ‌کنندهٔ تلاش‌های ثبت، در لایهٔ اتصال (نه در فرم).
 *
 * قواعد:
 *   • هر درخواست تازه کلید تکرار تازه می‌گیرد؛ تلاش دوباره برای **همان** درخواست همان کلید را
 *     می‌فرستد.
 *   • اگر نتیجه **نامشخص** باشد (`outcome_unknown` یا هر خطای غیرقراردادی)، همان درخواست و
 *     همان کلید «سنجاق» می‌شوند. تا روشن‌شدن نتیجه، درخواست متفاوتی فرستاده نمی‌شود؛ پس تغییر
 *     فرم یا بستن و بازکردن پنجره نمی‌تواند تلاش نامشخص را بی‌صدا به سفارش تازه تبدیل کند.
 *   • نتیجه با «تلاش دوباره» روشن می‌شود: اگر بک‌اند قبلاً ثبت کرده باشد، با همان کلید همان
 *     سفارش را برمی‌گرداند؛ اگر خطای قطعی بدهد، سنجاق برداشته می‌شود.
 *   • پس از شکست **قطعی**، چیزی ثبت نشده است؛ همان درخواست با همان کلید دوباره قابل ارسال است
 *     و درخواست تغییرکرده کلید تازه می‌گیرد.
 *
 * وضعیت فقط در حافظهٔ همین صفحه نگه داشته می‌شود. هیچ اطلاعات شخصی‌ای در localStorage یا
 * هیچ ذخیرهٔ دیگری نوشته نمی‌شود؛ پس با بارگذاری دوبارهٔ صفحه، سنجاق از دست می‌رود. در حالت‌های
 * عملیاتی، بازیابی پس از بارگذاری دوباره از راه «سفارش‌های من» در پنل مشتری انجام می‌شود.
 */
export interface SubmissionCoordinator {
  submit(request: OrderRequest): Promise<OrderReceipt>;
  /** همان درخواست سنجاق‌شده را با همان کلید دوباره می‌فرستد. */
  retryUnresolved(): Promise<OrderReceipt>;
  /** درخواستی که نتیجه‌اش نامشخص است؛ `null` یعنی چیزی در انتظار روشن‌شدن نیست. */
  getUnresolved(): OrderRequest | null;
}

interface Attempt {
  request: OrderRequest;
  fingerprint: string;
  idempotencyKey: string;
  unresolved: boolean;
}

export const UNRESOLVED_PREVIOUS_MESSAGE =
  'نتیجهٔ درخواست قبلی هنوز معلوم نیست؛ تا روشن‌شدن آن درخواست تازه‌ای فرستاده نمی‌شود.';

export function createSubmissionCoordinator(
  gateway: CustomerOrderGateway,
  onUnresolvedChange: (request: OrderRequest | null) => void = () => undefined,
  createKey: () => string = createIdempotencyKey,
): SubmissionCoordinator {
  let attempt: Attempt | null = null;
  let inFlight: { fingerprint: string; result: Promise<OrderReceipt>; token: object } | null = null;
  const isCurrentFlight = (token: object): boolean => inFlight !== null && inFlight.token === token;

  function setUnresolved(next: Attempt | null, unresolved: boolean) {
    const before = attempt?.unresolved ? attempt.request : null;
    if (next) next.unresolved = unresolved;
    attempt = next;
    const after = attempt?.unresolved ? attempt.request : null;
    if (before !== after) onUnresolvedChange(after);
  }

  function send(current: Attempt): Promise<OrderReceipt> {
    if (inFlight) {
      return inFlight.fingerprint === current.fingerprint
        ? inFlight.result
        : Promise.reject(new OrderGatewayError('conflict', 'درخواست دیگری در حال ارسال است.'));
    }
    const token = {};
    const result: Promise<OrderReceipt> = (async () => {
      // یک تأخیر کوچک تا `inFlight` پیش از صدا زدن adapter ثبت شده باشد، حتی اگر adapter
      // هم‌زمان (synchronous) خطا بدهد.
      await Promise.resolve();
      try {
        const receipt = await gateway.submitOrderRequest(current.request, {
          idempotencyKey: current.idempotencyKey,
        });
        if (attempt === current) setUnresolved(null, false);
        return receipt;
      } catch (error) {
        if (attempt === current) setUnresolved(current, isUncertainSubmitOutcome(error));
        throw error;
      } finally {
        if (isCurrentFlight(token)) inFlight = null;
      }
    })();
    inFlight = { fingerprint: current.fingerprint, result, token };
    return result;
  }

  return {
    submit(rawRequest) {
      const request = pickOrderRequest(rawRequest);
      const fingerprint = JSON.stringify(request);

      if (attempt?.unresolved) {
        if (attempt.fingerprint !== fingerprint) {
          return Promise.reject(new OrderGatewayError('outcome_unknown', UNRESOLVED_PREVIOUS_MESSAGE));
        }
        return send(attempt);
      }

      if (!attempt || attempt.fingerprint !== fingerprint) {
        setUnresolved({ request, fingerprint, idempotencyKey: createKey(), unresolved: false }, false);
      }
      return send(attempt as Attempt);
    },

    retryUnresolved() {
      if (!attempt?.unresolved) {
        return Promise.reject(new OrderGatewayError('validation', 'درخواستی با نتیجهٔ نامشخص وجود ندارد.'));
      }
      return send(attempt);
    },

    getUnresolved() {
      return attempt?.unresolved ? attempt.request : null;
    },
  };
}
