import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Search,
  X,
  MapPin,
  AlertCircle,
  Star,
  PhoneCall,
  Ban,
  Info,
} from 'lucide-react';
import { BookingOrder, OrderStatus } from '../types';
import {
  DemoBadge,
  DemoSampleBadge,
  DemoInlineNotice,
} from './DemoNotice';
import { DEMO_COPY } from '../config/capabilities';
import { LEGACY_DATA_NOTICE } from '../services/pii';

interface OrderTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: BookingOrder[];
  /**
   * فقط ثبت امتیاز عددی. مشتری اجازه تغییر وضعیت عملیاتی را ندارد.
   * باید Promise برگرداند تا پیام موفقیت فقط پس از ذخیره‌ی واقعی نمایش داده شود
   * و شکست ذخیره‌سازی به‌صورت خطای قابل‌مشاهده مدیریت شود.
   */
  onSubmitOrderRating: (orderId: string, rating: number) => Promise<unknown>;
  /** لغو نمایشی رکورد محلی؛ هیچ اثر عملیاتی ندارد. شکست آن باید قابل مدیریت باشد. */
  onCancelOrder: (orderId: string) => Promise<unknown>;
  /** آیا داده‌ای از نسخه قبلی سایت در این مرورگر وجود دارد؟ (فقط اطلاع‌رسانی) */
  hasLegacyStoredData?: boolean;
}

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({
  isOpen,
  onClose,
  orders,
  onSubmitOrderRating,
  onCancelOrder,
  hasLegacyStoredData = false
}) => {
  const [searchCode, setSearchCode] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<BookingOrder | null>(null);
  const [searchError, setSearchError] = useState<string>('');
  const [userStarRating, setUserStarRating] = useState(5);
  /**
   * متن بازخورد فقط در حافظه همین کامپوننت نگه داشته می‌شود و **ذخیره نمی‌شود**.
   * دلیل: متن آزاد می‌تواند حاوی شماره تماس یا نشانی باشد و نباید در
   * localStorage باقی بماند.
   */
  const [userFeedbackText, setUserFeedbackText] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [isRatingPending, setIsRatingPending] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [isCancelPending, setIsCancelPending] = useState(false);

  /**
   * شمارنده‌ی «دامنه» درخواست‌های غیرهمگام. با بستن پنجره یا تغییر سفارش افزایش
   * می‌یابد تا نتیجه‌ی دیرهنگام یک درخواست قدیمی، پیام موفقیت/خطا را روی سفارش
   * دیگر یا پس از بستن پنجره نشان ندهد.
   */
  const requestScopeRef = useRef(0);

  // Privacy: clear ephemeral feedback, success and errors whenever modal closes or order changes.
  // useLayoutEffect (نه useEffect): ریست و افزایش scope باید در همان commitی انجام شود
  // که سفارش جدید را در DOM نشان می‌دهد؛ در غیر این صورت کلیکی که بین paint و اجرای
  // effect معمولی رخ دهد scope قدیمی را می‌گیرد و خطای واقعی به‌اشتباه پنهان می‌شود.
  useLayoutEffect(() => {
    requestScopeRef.current += 1;
    setUserFeedbackText('');
    setRatingSubmitted(false);
    setRatingError('');
    setIsRatingPending(false);
    setCancelError('');
    setIsCancelPending(false);
    setSearchError('');
    setUserStarRating(5);
    if (!isOpen) {
      setSelectedOrder(null);
      setSearchCode('');
    }
  }, [isOpen, selectedOrder?.id]);

  // انتخاب اولیه پس از بارگذاری سفارش‌های آزمایشی (و همگام‌سازی با تغییر فهرست).
  useEffect(() => {
    if (!isOpen) return;
    setSelectedOrder((current) => {
      if (current && orders.some((order) => order.id === current.id)) {
        return orders.find((order) => order.id === current.id) ?? current;
      }
      return orders[0] ?? null;
    });
  }, [isOpen, orders]);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchCode.trim().toUpperCase();
    if (!query) return;

    // جست‌وجو فقط در رکوردهای نمایشی همین مرورگر انجام می‌شود.
    const found = orders.find(
      (order) =>
        order.trackingCode.toUpperCase() === query ||
        order.id.toUpperCase() === query
    );

    if (found) {
      setSelectedOrder(found);
      setSearchError('');
    } else {
      setSearchError(
        'درخواستی با این کد در همین مرورگر یافت نشد. در نسخه آزمایشی هیچ سامانه مرکزی برای رهگیری وجود ندارد.',
      );
    }
  };

  const getStatusStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 0;
      case 'assigned': return 1;
      case 'on_the_way': return 2;
      case 'in_progress': return 3;
      case 'completed': return 4;
      case 'cancelled': return -1;
      default: return 0;
    }
  };

  const statusSteps = [
    { title: 'ثبت درخواست', desc: 'درخواست شما ثبت شد' },
    { title: 'تخصیص متخصص', desc: 'نیازمند سرور عملیات' },
    { title: 'در مسیر اعزام', desc: 'نیازمند سرور عملیات' },
    { title: 'در حال نظافت', desc: 'نیازمند سرور عملیات' },
    { title: 'پایان کار', desc: 'نیازمند سرور عملیات' },
  ];

  const handleCancelOrder = async () => {
    if (!selectedOrder || isCancelPending) return;
    if (!confirm('این لغو فقط رکورد نمایشی همین مرورگر را علامت می‌زند. ادامه می‌دهید؟')) return;

    const scope = requestScopeRef.current;
    setCancelError('');
    setIsCancelPending(true);
    try {
      // وضعیت «لغو شده» فقط از رکورد به‌روزشده‌ی context می‌آید، یعنی فقط پس از ذخیره‌ی موفق.
      await onCancelOrder(selectedOrder.id);
    } catch {
      if (scope !== requestScopeRef.current) return;
      setCancelError(CANCEL_ERROR_TEXT);
    } finally {
      if (scope === requestScopeRef.current) setIsCancelPending(false);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || isRatingPending) return;

    const scope = requestScopeRef.current;
    setRatingError('');
    setIsRatingPending(true);
    try {
      // فقط امتیاز عددی ارسال و ذخیره می‌شود؛ متن بازخورد ارسال نمی‌شود.
      await onSubmitOrderRating(selectedOrder.id, userStarRating);
      // پیام موفقیت فقط پس از ذخیره‌ی واقعی و فقط برای همان سفارش/همان باز بودن پنجره.
      if (scope !== requestScopeRef.current) return;
      setRatingSubmitted(true);
    } catch {
      if (scope !== requestScopeRef.current) return;
      setRatingError(RATING_ERROR_TEXT);
    } finally {
      if (scope === requestScopeRef.current) setIsRatingPending(false);
    }
  };

  const currentStepIdx = selectedOrder ? getStatusStepIndex(selectedOrder.status) : 0;
  const isDemoStatus = selectedOrder ? selectedOrder.status === 'pending' : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]">

        {/* Header */}
        <div className="p-5 sm:px-8 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <DemoBadge />
              <span className="text-xs font-bold text-slate-500">رهگیری آزمایشی</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              درخواست‌های نمایشی همین مرورگر
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-8 overflow-y-auto flex-1 space-y-6 text-slate-800">

          <DemoInlineNotice text={DEMO_COPY.orderFlowNotice} />

          {hasLegacyStoredData && (
            <div className="p-3 rounded-2xl bg-slate-100 border border-slate-300 text-slate-700 text-[11px] leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
              <span>{LEGACY_DATA_NOTICE}</span>
            </div>
          )}

          {/* Search by tracking code */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="کد پیگیری آزمایشی (مثلا DEMO-...)"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pr-10 pl-3 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all cursor-pointer shrink-0"
            >
              جستجو
            </button>
          </form>

          {searchError && (
            <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {searchError}
            </p>
          )}

          {/* Quick Select from existing demo orders */}
          {orders.length > 1 && (
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-2">
                درخواست‌های آزمایشی این مرورگر:
              </span>
              <div className="flex flex-wrap gap-2">
                {orders.map((ord) => (
                  <button
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                      selectedOrder?.id === ord.id
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ord.trackingCode}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedOrder ? (
            <div className="space-y-6">

              {/* Demo order info card */}
              <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-4 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs text-slate-400 block">کد پیگیری آزمایشی:</span>
                    <strong className="text-lg font-black font-mono text-emerald-400">
                      {selectedOrder.trackingCode}
                    </strong>
                  </div>
                  <div className="text-left">
                    <span className="text-xs text-slate-400 block">زمان ثبت در این مرورگر:</span>
                    <span className="text-xs font-medium text-slate-200">
                      {formatCreatedAt(selectedOrder.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">نوع خدمت:</span>
                    <strong className="text-white">{selectedOrder.serviceTitle}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">مدت زمان:</span>
                    <strong className="text-white font-mono">{selectedOrder.hours} ساعت</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">تاریخ درخواستی:</span>
                    <strong className="text-white">{selectedOrder.date}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{DEMO_COPY.provisionalPriceLabel}:</span>
                    <strong className="text-emerald-400 font-mono">
                      {selectedOrder.totalPrice.toLocaleString('fa-IR')} ت
                    </strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                  <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                    وضعیت پرداخت: ثبت نشده
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                    مبلغ نهایی: پس از تأیید سرور
                  </span>
                </div>

                {/* Masked / redacted customer data stored locally */}
                <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700 text-[11px] text-slate-300 space-y-1">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <MapPin className="w-3.5 h-3.5" />
                    اطلاعات ذخیره‌شده روی همین دستگاه (ماسک‌شده)
                  </span>
                  <span className="block">{selectedOrder.customerName || '—'}</span>
                  <span className="block font-mono" dir="ltr">{selectedOrder.customerPhone || '—'}</span>
                  <span className="block text-slate-400">
                    نشانی دقیق برای حفاظت از حریم خصوصی در نسخه آزمایشی ذخیره نمی‌شود.
                  </span>
                </div>
              </div>

              {/* Status: demonstration only */}
              {selectedOrder.status !== 'cancelled' ? (
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">
                      مراحل اجرای سفارش
                    </h4>
                    <span className="text-xs text-amber-800 bg-amber-100 font-bold px-2.5 py-0.5 rounded-full">
                      نمایشی
                    </span>
                  </div>

                  <div className="relative pt-2 pb-2">
                    <div className="grid grid-cols-5 gap-1 relative text-center">
                      {statusSteps.map((step, idx) => {
                        const isDone = currentStepIdx >= idx;
                        const isCurrent = currentStepIdx === idx;
                        return (
                          <div key={idx} className="space-y-1.5 flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              isCurrent
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-md'
                                : isDone
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 text-slate-500'
                            }`}>
                              {isDone && !isCurrent ? '✓' : idx + 1}
                            </div>
                            <span className={`text-[11px] font-bold block ${isCurrent ? 'text-emerald-800' : isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                              {step.title}
                            </span>
                            <span className="hidden sm:block text-[9px] text-slate-400 leading-tight">
                              {step.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border border-amber-200 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {isDemoStatus
                        ? 'مراحل بعدی در نسخه آزمایشی هرگز فعال نمی‌شوند، چون سامانه اعزام سرور پاک‌شو به این سایت متصل نیست. وضعیت ثبت‌شده در این صفحه وضعیت عملیاتی واقعی نیست و مشتری نمی‌تواند آن را تغییر دهد.'
                        : 'تمدید خودکار وضعیت در نسخه آزمایشی انجام نمی‌شود.'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
                  <Ban className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>
                    این رکورد نمایشی در همین مرورگر لغو شده است. چون هیچ درخواستی به سامانه عملیاتی
                    ارسال نشده، لغو نیز اثری در عملیات پاک‌شو ندارد.
                  </span>
                </div>
              )}

              {/* Requested cleaner: display-only, never an assignment; no phone number */}
              {selectedOrder.requestedCleanerName && (
                <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-500">درخواست شما برای همکاری با:</span>
                    <DemoSampleBadge />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">{selectedOrder.requestedCleanerName}</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{DEMO_COPY.noCleanerAssignment}</p>
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-[11px] text-slate-500">
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>شماره تماس متخصص در نسخه آزمایشی نمایش داده نمی‌شود.</span>
                  </div>
                </div>
              )}

              {/* Rating & feedback */}
              {selectedOrder.status === 'pending' && (
                <div className="p-5 rounded-3xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <h4 className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                    بازخورد شما درباره این نسخه آزمایشی
                  </h4>

                  {ratingSubmitted || selectedOrder.userRating ? (
                    <div className="p-3 bg-white rounded-2xl border border-amber-200 space-y-1.5">
                      <p className="text-xs text-emerald-800 font-bold text-center">
                        ✓ امتیاز {selectedOrder.userRating || userStarRating} ستاره در همین مرورگر ثبت شد.
                      </p>
                      {userFeedbackText.trim() && (
                        <>
                          <p className="text-[11px] text-slate-700 leading-relaxed">«{userFeedbackText.trim()}»</p>
                          <p className="text-[10px] text-slate-500">
                            این متن ذخیره نشده است و با بستن یا بارگذاری مجدد صفحه از بین می‌رود.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitRating} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-700 font-bold">امتیاز شما:</span>
                        <div className="flex items-center gap-1 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setUserStarRating(s)}
                              aria-label={`امتیاز ${s}`}
                              className="p-1 cursor-pointer"
                            >
                              <Star className={`w-5 h-5 ${s <= userStarRating ? 'fill-amber-400' : 'text-slate-300'}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        متن بازخورد ذخیره نمی‌شود و فقط تا بستن این پنجره نمایش داده می‌شود؛
                        شماره تلفن، نشانی یا هر اطلاعات شخصی دیگری را وارد نکنید.
                      </p>

                      <textarea
                        rows={2}
                        placeholder="نظر شما درباره این نسخه آزمایشی..."
                        value={userFeedbackText}
                        onChange={(e) => setUserFeedbackText(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
                      />

                      <button
                        type="submit"
                        disabled={isRatingPending}
                        className="py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        {isRatingPending ? 'در حال ثبت...' : 'ثبت امتیاز'}
                      </button>

                      {ratingError && (
                        <p role="alert" className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {ratingError}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              )}

              {/* Order actions */}
              {selectedOrder.status !== 'cancelled' && cancelError && (
                <p role="alert" className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {cancelError}
                </p>
              )}
              {selectedOrder.status !== 'cancelled' && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    onClick={handleCancelOrder}
                    disabled={isCancelPending}
                    className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-60 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{isCancelPending ? 'در حال لغو...' : 'لغو رکورد نمایشی'}</span>
                  </button>

                  <span className="text-xs text-slate-600 font-bold">
                    راه تماس رسمی پشتیبانی هنوز تأیید نشده است.
                  </span>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs">هنوز درخواست آزمایشی در این مرورگر ثبت نشده است.</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

/** پیام‌های شکست ذخیره‌سازی؛ هیچ‌کدام موفقیت را اعلام نمی‌کنند. */
const RATING_ERROR_TEXT =
  'ثبت امتیاز ناموفق بود؛ امتیاز در حافظه مرورگر ذخیره نشد. ممکن است حافظه مرورگر پر یا غیرفعال باشد.';
const CANCEL_ERROR_TEXT =
  'لغو رکورد ناموفق بود؛ رکورد تغییری نکرد. ممکن است حافظه مرورگر پر یا غیرفعال باشد.';

/** نمایش خوانای زمان ثبت ISO با پشتیبانی از رکوردهای قدیمی. */
function formatCreatedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('fa-IR');
}
