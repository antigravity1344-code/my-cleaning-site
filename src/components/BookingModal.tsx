import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
import {
  X, Check, ArrowLeft, ArrowRight,
  Sparkles, CheckCircle2, Copy, Receipt
} from 'lucide-react';
import { SERVICES_LIST, CLEANERS_LIST, CITIES_DATA } from '../data/mockData';
import { ServiceType, CleanerGender, BookingOrder } from '../types';
import { CreateOrderDTO } from '../services/orderService.types';
import { calculatePrice, validatePromoCode } from '../pricing/pricingEngine';
import { buildDemoOrderPayload } from '../services/demoOrder';
import { toLatinDigits } from '../services/pii';
import { validateOrderContact } from '../validation/orderContactValidation';
import {
  isPakshoConfigured,
  requestQuote,
  sendOtp,
  verifyOtp,
  getSiteFeatures,
  createOrder as createPakshoOrder,
  PakshoApiError,
  type PakshoQuote,
  type SiteFeatures,
} from '../services/pakshoApi';
import { DemoBadge, DemoSampleBadge, DemoInlineNotice, ProvisionalPriceNote } from './DemoNotice';
import { DEMO_COPY, ONLINE_PAYMENT_AVAILABLE, CLEANER_ASSIGNMENT_AVAILABLE } from '../config/capabilities';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { ChoiceCard } from './ChoiceCard';

/** بازه‌های زمانی قابل انتخاب در فرم آزمایشی رزرو. */
const TIME_SLOTS = [
  '۰۸:۳۰ الی ۱۲:۳۰ (صبح زود)',
  '۱۲:۳۰ الی ۱۶:۳۰ (ظهر و بعدازظهر)',
  '۱۶:۳۰ الی ۲۰:۳۰ (عصر و غروب)',
];

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialServiceId?: ServiceType;
  initialParams?: {
    serviceId: ServiceType;
    cleanerGender: CleanerGender;
    hours: number;
    squareMeters?: number;
    roomsCount?: number;
    selectedAddons?: string[];
    hasDetergentPackage?: boolean;
    cityName?: string;
    cleanerId?: string;
  };
  onOrderCreated: (order: BookingOrder) => void;
  createOrderService?: (orderData: CreateOrderDTO) => Promise<BookingOrder>;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  initialServiceId = 'home-standard',
  initialParams,
  onOrderCreated,
  createOrderService
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [serviceId, setServiceId] = useState<ServiceType>(initialServiceId);
  const [cleanerGender, setCleanerGender] = useState<CleanerGender>('no-pref');
  const [hours, setHours] = useState<number>(4);
  const [squareMeters, setSquareMeters] = useState<number>(90);
  const [roomsCount, setRoomsCount] = useState<number>(2);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [hasDetergentPackage, setHasDetergentPackage] = useState<boolean>(true);

  // Date & Time & Cleaner
  const [selectedDate, setSelectedDate] = useState<string>('امروز');
  // پیش‌فرض باید یکی از گزینه‌های واقعی فرم باشد؛ مقدار قبلی (۰۹:۰۰ الی ۱۳:۰۰) در فهرست
  // نبود، پس هیچ گزینه‌ای انتخاب‌شده دیده نمی‌شد ولی همان مقدارِ نامرئی ثبت می‌شد.
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(TIME_SLOTS[0]);
  const [selectedCleanerId, setSelectedCleanerId] = useState<string>('auto');

  // Address & Contact
  const [cityName, setCityName] = useState<string>('تهران');
  const [district, setDistrict] = useState<string>('سعادت‌آباد و شهرک غرب');
  const [address, setAddress] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  // حالت پاکشو: قیمت از سرور، و ثبت نهایی با کد پیامکی (بدون ورود قبلی).
  const [serverQuote, setServerQuote] = useState<PakshoQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string>('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const clientRequestRef = useRef<string>('');
  // کلیدهای سایت از سرور: افزودنی/کد تخفیف و پکیج شوینده (پیش‌فرض خاموش تا پاسخ برسد).
  const [siteFlags, setSiteFlags] = useState<SiteFeatures>({ siteExtras: false, detergentPackage: false });
  const [notes, setNotes] = useState<string>('');

  // Discount & Payment
  const [discountCodeInput, setDiscountCodeInput] = useState<string>('');
  // فقط «کد» نگه داشته می‌شود؛ مبلغ تخفیف را موتور قیمت‌گذاری محاسبه می‌کند.
  const [appliedPromoCode, setAppliedPromoCode] = useState<string>('');
  const [discountMsg, setDiscountMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash_on_site'>('cash_on_site');

  // Error & Submission States
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // قفل هم‌زمان ثبت: state تا رندر بعدی به‌روز نمی‌شود؛ دو رویداد ثبت پیش از آن رندر
  // (مثلاً دو کلیک در یک task مرورگر) هر دو isSubmitting=false می‌دیدند و دو سفارش ثبت می‌شد.
  const submitLockRef = useRef(false);

  // Success screen state
  const [createdOrder, setCreatedOrder] = useState<BookingOrder | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Reset & Hydrate States
  useEffect(() => {
    if (isOpen) {
      if (initialParams) {
        if (initialParams.serviceId) setServiceId(initialParams.serviceId);
        if (initialParams.cleanerGender) setCleanerGender(initialParams.cleanerGender);
        if (initialParams.hours) {
          // دفاع در عمق: هر مقدار ساعتی که از بیرون می‌آید (مثلاً از لینک/استیت
          // قدیمی یا مسیرهای بعدی) حتماً باید در بازه [minHours همان خدمت, 12]
          // باشد، چون calculatePrice خودش این محدودیت را اعمال نمی‌کند.
          const targetService = SERVICES_LIST.find(
            (s) => s.id === (initialParams.serviceId ?? serviceId),
          ) ?? SERVICES_LIST[0];
          const clampedHours = Math.max(
            targetService.minHours,
            Math.min(12, initialParams.hours),
          );
          setHours(clampedHours);
        }
        if (initialParams.squareMeters) setSquareMeters(initialParams.squareMeters);
        if (initialParams.roomsCount) setRoomsCount(initialParams.roomsCount);
        if (initialParams.selectedAddons) setSelectedAddons(initialParams.selectedAddons);
        if (initialParams.hasDetergentPackage !== undefined) setHasDetergentPackage(initialParams.hasDetergentPackage);
        if (initialParams.cityName) setCityName(initialParams.cityName);
        if (initialParams.cleanerId) setSelectedCleanerId(initialParams.cleanerId);
      } else if (initialServiceId) {
        setServiceId(initialServiceId);
        const s = SERVICES_LIST.find(x => x.id === initialServiceId);
        if (s) setHours(s.minHours);
      }
    } else {
      setCurrentStep(1);
      setServiceId(initialServiceId);
      setCleanerGender('no-pref');
      setHours(4);
      setSquareMeters(90);
      setRoomsCount(2);
      setSelectedAddons([]);
      setHasDetergentPackage(true);
      setSelectedDate('امروز');
      setSelectedTimeSlot(TIME_SLOTS[0]);
      setSelectedCleanerId('auto');
      setAddress('');
      setUnit('');
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setDiscountCodeInput('');
      setAppliedPromoCode('');
      setDiscountMsg(null);
      setFormError('');
      setCreatedOrder(null);
    }
  }, [isOpen, initialParams, initialServiceId]);

  useEffect(() => {
    const cityObj = CITIES_DATA.find(c => c.name === cityName);
    if (cityObj && cityObj.districts.length > 0) {
      setDistrict(cityObj.districts[0]);
    }
  }, [cityName]);

  const currentService = SERVICES_LIST.find(s => s.id === serviceId) || SERVICES_LIST[0];

  // محاسبه قیمت از موتور مشترک قیمت‌گذاری — دقیقاً همان تابعی که محاسبه‌گر
  // هزینه استفاده می‌کند، بنابراین مبلغ فاکتور با مبلغ نمایش‌داده‌شده در
  // محاسبه‌گر همیشه یکسان است.
  // افزودنی‌ها، پاک‌کننده و کد تخفیف از فرم حذف شده‌اند (تصمیم مالک، ۹ نوامبر ۲۰۲۶).
  const pricing = useMemo(
    () =>
      calculatePrice({
        serviceId,
        hours,
        addonIds: [],
        hasDetergentPackage: false,
      }),
    [serviceId, hours],
  );

  const pakshoMode = isPakshoConfigured();
  const extrasOn = pakshoMode && siteFlags.siteExtras;
  const detergentAvailable = extrasOn && siteFlags.detergentPackage;
  const detergentOn = detergentAvailable && hasDetergentPackage;
  const quoteDiscount = extrasOn && appliedPromoCode ? appliedPromoCode : undefined;
  const baseServicePrice = pakshoMode ? (serverQuote?.subtotal ?? 0) : pricing.serviceBase;
  const totalPrice = pakshoMode ? (serverQuote?.total ?? 0) : pricing.serviceBase;

  // کلیدهای سایت: یک بار وقتی مودال باز است و مشتری در حالت پاکشو است.
  useEffect(() => {
    if (!isOpen || !pakshoMode) return;
    let cancelled = false;
    getSiteFeatures()
      .then((flags) => { if (!cancelled) setSiteFlags(flags); })
      .catch(() => { if (!cancelled) setSiteFlags({ siteExtras: false, detergentPackage: false }); });
    return () => { cancelled = true; };
  }, [isOpen, pakshoMode]);

  // قیمت از سرور پاکشو؛ با تغییر خدمت، ساعت، پکیج شوینده یا کد تخفیف دوباره گرفته می‌شود.
  useEffect(() => {
    if (!isOpen || !pakshoMode) return;
    let cancelled = false;
    setServerQuote(null);
    setQuoteError('');
    requestQuote({
      serviceId,
      quantity: hours,
      options: detergentOn ? { detergent: true } : {},
      discountCode: quoteDiscount,
    })
      .then((quote) => { if (!cancelled) setServerQuote(quote); })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof PakshoApiError && error.code?.startsWith('PROMO_')) {
          // کد نامعتبر: کد برداشته می‌شود تا مشتری بدون تخفیف ادامه دهد و پیام روشن ببیند.
          setAppliedPromoCode('');
          setDiscountMsg({ type: 'error', text: error.message });
          return;
        }
        setQuoteError(
          error instanceof PakshoApiError && error.code === 'FEATURE_DISABLED'
            ? error.message
            : 'قیمت از سرور دریافت نشد. دوباره تلاش کنید.',
        );
      });
    return () => { cancelled = true; };
  }, [isOpen, pakshoMode, serviceId, hours, detergentOn, quoteDiscount]);

  // دسترس‌پذیری پنجره: نقش dialog، Escape برای بستن، نگه‌داشتن فوکوس داخل پنجره
  // و بازگرداندن فوکوس به دکمه بازکننده (پیش از return زودهنگام).
  const dialogRef = useDialogA11y(isOpen, onClose);
  const titleId = useId();
  // پیشوند یکتا برای id برچسب‌ها و name گروه‌های گزینه (چند نمونه از فرم با هم تداخل نکنند).
  const fieldId = useId();

  // بازگشت زودهنگام باید **بعد از همه هوک‌ها** باشد؛ در غیر این صورت وقتی مودال
  // بسته رندر و سپس باز می‌شود، تعداد هوک‌ها تغییر می‌کند و React خطای
  // «Rendered more hooks than during the previous render» می‌دهد.
  if (!isOpen) return null;

  // Handlers
  const handleApplyDiscount = () => {
    const code = discountCodeInput.trim().toUpperCase();
    if (!code) return;
    if (pakshoMode) {
      // در حالت پاکشو اعتبار کد را سرور می‌سنجد؛ نتیجه از روی نقل‌قول می‌آید.
      setAppliedPromoCode(code);
      setDiscountMsg({ type: 'success', text: `کد ${code} بررسی می‌شود.` });
      return;
    }

    const result = validatePromoCode(code);
    if (!result.valid) {
      setAppliedPromoCode('');
      setDiscountMsg({ type: 'error', text: 'کد تخفیف معتبر نیست.' });
      return;
    }

    // تخفیف هرگز دوباره اعمال نمی‌شود: تنها یک کد در هر سفارش نگه داشته می‌شود
    // و موتور قیمت‌گذاری خودش سقف تخفیف را با جمع اقلام محدود می‌کند.
    setAppliedPromoCode(result.code);
    setDiscountMsg({
      type: 'success',
      text: `کد تخفیف ${result.code} ثبت شد (${result.amount.toLocaleString('fa-IR')} تومان). اعتبارسنجی نهایی به‌عهده سرور پاک‌شو است.`,
    });
  };

  const handleRemoveDiscount = () => {
    setAppliedPromoCode('');
    setDiscountCodeInput('');
    setDiscountMsg(null);
  };

  const validateStep3 = (): boolean => {
    setFormError('');
    const result = validateOrderContact({ address, name: customerName, phone: customerPhone });
    if (!result.valid) {
      setFormError(result.errorMessage ?? '');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 3 && !validateStep3()) return;
    setFormError('');
    setCurrentStep(prev => prev + 1);
  };

  // ثبت سفارش در سرور پاکشو: مرحلهٔ اول کد پیامکی می‌فرستد، مرحلهٔ دوم کد را تأیید و سفارش را ثبت می‌کند.
  const submitToPaksho = async (orderPayload: CreateOrderDTO): Promise<BookingOrder> => {
    const phone = toLatinDigits(customerPhone.trim());
    let token = customerToken;
    if (!token) {
      if (!otpSent) {
        await sendOtp(phone);
        setOtpSent(true);
        throw new Error('کد تأیید برای شماره شما پیامک شد. کد را وارد کنید و دوباره تأیید نهایی بزنید.');
      }
      const code = toLatinDigits(otpCode.trim());
      if (!/^\d{4}$/.test(code)) throw new Error('کد پیامکی ۴ رقمی را وارد کنید.');
      token = await verifyOtp(phone, code);
      setCustomerToken(token);
    }
    if (!serverQuote) throw new Error('قیمت هنوز دریافت نشده است. صبر کنید و دوباره تلاش کنید.');
    if (!clientRequestRef.current) clientRequestRef.current = crypto.randomUUID();

    const result = await createPakshoOrder(token, {
      serviceId,
      quantity: hours,
      quoteToken: serverQuote.quoteToken,
      confirmedTotal: serverQuote.total,
      address: [cityName, district, address.trim(), unit.trim()].filter(Boolean).join('، '),
      date: selectedDate,
      time: selectedTimeSlot,
      customerName: customerName.trim(),
      customerPhone: phone,
      notes: notes.trim(),
      clientRequestId: clientRequestRef.current,
      options: detergentOn ? { detergent: true } : {},
      discountCode: quoteDiscount,
    });

    // TODO: نوع رکورد عملیاتی در مدل نیست؛ همان قرار httpOrderService فعلاً 'demo' می‌ماند.
    return {
      ...orderPayload,
      id: result.id,
      trackingCode: result.id,
      createdAt: new Date().toISOString(),
      status: 'pending',
      recordType: 'demo',
      paymentStatus: 'unpaid',
      totalPrice: result.price,
    };
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting || submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setFormError('');

    // انتخاب متخصص در نسخه آزمایشی هیچ‌گاه به «تخصیص» تبدیل نمی‌شود:
    // نه متخصصی انتخاب می‌شود، نه شماره تماسی ساخته می‌شود.
    const requestedCleaner = CLEANERS_LIST.find(c => c.id === selectedCleanerId);

    const orderPayload: CreateOrderDTO = buildDemoOrderPayload({
      serviceId,
      serviceTitle: currentService.title,
      cleanerGender,
      hours,
      squareMeters,
      roomsCount,
      selectedAddons,
      hasDetergentPackage,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      cityName,
      district,
      address: address.trim(),
      unit: unit.trim(),
      customerName: customerName.trim(),
      customerPhone: toLatinDigits(customerPhone.trim()),
      notes: notes.trim(),
      totalPrice,
      discountApplied: pricing.discountsTotal,
      requestedCleanerId: requestedCleaner?.id,
      requestedCleanerName: requestedCleaner?.name,
      paymentMethod,
    });

    if (pakshoMode) {
      try {
        const created = await submitToPaksho(orderPayload);
        setCreatedOrder(created);
        onOrderCreated(created);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'ثبت سفارش ناموفق بود؛ دوباره تلاش کنید.');
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    try {
      if (!createOrderService) {
        throw new Error('سرویس ثبت سفارش در دسترس نیست.');
      }
      const created = await createOrderService(orderPayload);
      setCreatedOrder(created);
      onOrderCreated(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setFormError(
        message.includes('حافظه') || message.includes('ذخیره‌سازی')
          ? 'ذخیره‌سازی محلی مرورگر ناموفق بود؛ درخواست آزمایشی ثبت نشد.'
          : 'ثبت درخواست آزمایشی ناموفق بود. مجدداً تلاش فرمایید.',
      );
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  // دکمه‌ی «مرحله بعد» و «تأیید نهایی» یک جا دارند؛ اگر Enter نگه داشته شود، تکرار خودکار
  // کلید نباید از مرحله‌ی فاکتور رد شود و سفارش را ثبت کند.
  const ignoreAutoRepeat = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat) event.preventDefault();
  };

  const handleFormSubmitWrapper = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 4) handleNextStep();
    else handleFinalSubmit();
  };

  const handleCopyTrackingCode = () => {
    if (createdOrder) {
      navigator.clipboard?.writeText(createdOrder.trackingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };// --- Sub-Render Helpers ---

  const renderSuccessScreen = () => {
    if (!createdOrder) return null;
    return (
      <div className="text-center py-6 sm:py-8 space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-center"><DemoBadge /></div>
          <h4 className="text-2xl font-black text-slate-900">{DEMO_COPY.successTitle}</h4>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            {DEMO_COPY.successDescription}
          </p>
        </div>
        <div className="bg-slate-900 text-white p-5 rounded-3xl max-w-md mx-auto space-y-3 shadow-xl">
          <span className="text-xs text-white/65 block">کد پیگیری آزمایشی:</span>
          <div className="flex items-center justify-center gap-3 bg-slate-800 p-3 rounded-2xl border border-slate-700">
            <span className="text-xl font-black font-mono text-emerald-400 tracking-wider">{createdOrder.trackingCode}</span>
            <button
              type="button"
              onClick={handleCopyTrackingCode}
              aria-label={copiedCode ? 'کد پیگیری کپی شد' : 'کپی کد پیگیری'}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {createdOrder.requestedCleanerName && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-md mx-auto space-y-1 text-right">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">درخواست شما برای همکاری با:</span>
              <DemoSampleBadge />
            </div>
            <strong className="text-slate-900 font-bold block text-sm">{createdOrder.requestedCleanerName}</strong>
            <span className="text-[11px] text-slate-600 block">{DEMO_COPY.noCleanerAssignment}</span>
          </div>
        )}
        <DemoInlineNotice text={DEMO_COPY.notificationsNotice} className="max-w-md mx-auto text-right" />
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 text-sm transition-colors cursor-pointer"
          >
            بستن و بازگشت به سایت
          </button>
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <span id={`${fieldId}-service`} className="block text-xs font-bold text-slate-700 mb-2">نوع خدمت نظافت مورد نظر:</span>
        <div role="radiogroup" aria-labelledby={`${fieldId}-service`} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SERVICES_LIST.map((srv) => (
            <ChoiceCard
              key={srv.id}
              type="radio"
              name={`${fieldId}-service`}
              checked={serviceId === srv.id}
              onChange={() => {
                setServiceId(srv.id);
                if (hours < srv.minHours) setHours(srv.minHours);
              }}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                serviceId === srv.id ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="block">
                <span className="text-xs font-bold text-slate-900 block">{srv.title}</span>
                <span className="text-[11px] text-slate-500 font-mono">{srv.baseHourlyRate.toLocaleString('fa-IR')} ت / ساعت</span>
              </span>
              {serviceId === srv.id && <span aria-hidden="true" className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">✓</span>}
            </ChoiceCard>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
          <span id={`${fieldId}-hours`}>تعداد ساعت کار نیرو:</span>
          <span aria-hidden="true" className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono text-sm">{hours} ساعت</span>
        </div>
        <input
          type="range"
          min={currentService.minHours}
          max={12}
          step={1}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          aria-labelledby={`${fieldId}-hours`}
          aria-valuetext={`${hours} ساعت`}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
        />
      </div>
      <div>
        <span id={`${fieldId}-gender`} className="block text-xs font-bold text-slate-700 mb-2">اولویت جنسیت متخصص نظافت:</span>
        <div role="radiogroup" aria-labelledby={`${fieldId}-gender`} className="grid grid-cols-3 gap-2">
          {[{ id: 'female', label: 'خانم' }, { id: 'male', label: 'آقا' }, { id: 'no-pref', label: 'تفاوتی ندارد' }].map(g => (
            <ChoiceCard
              key={g.id}
              type="radio"
              name={`${fieldId}-gender`}
              checked={cleanerGender === g.id}
              onChange={() => setCleanerGender(g.id as CleanerGender)}
              className={`flex items-center justify-center text-center py-2.5 px-2 text-xs font-bold rounded-xl border transition-all ${
                cleanerGender === g.id ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              نظافتچی {g.label}
            </ChoiceCard>
          ))}
        </div>
      </div>
      {detergentAvailable && (
        <ChoiceCard
          type="checkbox"
          checked={hasDetergentPackage}
          onChange={() => setHasDetergentPackage(!hasDetergentPackage)}
          className={`w-full flex items-center justify-between p-3 rounded-2xl border text-right text-xs font-bold transition-all ${
            hasDetergentPackage ? 'bg-teal-50 border-teal-500' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          پکیج مواد شوینده (افزودنی؛ محتوای هر خدمت جداست)
        </ChoiceCard>
      )}
    </div>
  );

  const renderStep2 = () => {
    const dates = [
      { id: 'امروز', label: 'امروز', sub: 'انتخاب شما' },
      { id: 'فردا', label: 'فردا', sub: 'انتخاب شما' },
      { id: 'پس‌فردا', label: 'پس‌فردا', sub: 'انتخاب شما' },
      { id: '۳ روز بعد', label: '۳ روز بعد', sub: 'انتخاب شما' },
      { id: 'هفته آینده', label: 'پایان هفته', sub: 'انتخاب شما' }
    ];
    return (
      <div className="space-y-6">
        <div>
          <span id={`${fieldId}-date`} className="block text-xs font-bold text-slate-700 mb-2">روز مراجعه نیروی خدماتی:</span>
          <div role="radiogroup" aria-labelledby={`${fieldId}-date`} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {dates.map((d) => (
              <ChoiceCard
                key={d.id}
                type="radio"
                name={`${fieldId}-date`}
                checked={selectedDate === d.id}
                onChange={() => setSelectedDate(d.id)}
                className={`block p-3 text-right rounded-2xl border transition-all ${
                  selectedDate === d.id ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`text-xs font-bold block ${selectedDate === d.id ? 'text-emerald-900' : 'text-slate-800'}`}>{d.label}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">{d.sub}</span>
              </ChoiceCard>
            ))}
          </div>
        </div>
        <div>
          <span id={`${fieldId}-slot`} className="block text-xs font-bold text-slate-700 mb-2">بازه زمانی شروع کار:</span>
          <div role="radiogroup" aria-labelledby={`${fieldId}-slot`} className="space-y-2">
            {TIME_SLOTS.map((slot) => (
              <ChoiceCard
                key={slot}
                type="radio"
                name={`${fieldId}-slot`}
                checked={selectedTimeSlot === slot}
                onChange={() => setSelectedTimeSlot(slot)}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                  selectedTimeSlot === slot ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold text-slate-800">{slot}</span>
                {selectedTimeSlot === slot && <span aria-hidden="true" className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>}
              </ChoiceCard>
            ))}
          </div>
        </div>
        <div>
          <span id={`${fieldId}-cleaner`} className="block text-xs font-bold text-slate-700 mb-1">انتخاب متخصص (فهرست نمونه):</span>
          <p id={`${fieldId}-cleaner-note`} className="text-[11px] text-slate-500 mb-2 leading-relaxed">
            {CLEANER_ASSIGNMENT_AVAILABLE
              ? 'انتخاب شما به موتور تخصیص سرور پاک‌شو ارسال می‌شود.'
              : 'پروفایل‌های زیر نمونه هستند. در نسخه آزمایشی هیچ متخصصی تخصیص داده نمی‌شود؛ انتخاب شما فقط به‌عنوان «درخواست» ثبت می‌شود.'}
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`${fieldId}-cleaner`}
            aria-describedby={`${fieldId}-cleaner-note`}
            className="space-y-2"
          >
            <ChoiceCard
              type="radio"
              name={`${fieldId}-cleaner`}
              checked={selectedCleanerId === 'auto'}
              onChange={() => setSelectedCleanerId('auto')}
              className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                selectedCleanerId === 'auto' ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-3">
                <span aria-hidden="true" className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </span>
                <span className="block text-right">
                  <span className="text-xs font-bold text-slate-900 block">بدون اولویت خاص (پیشنهادی)</span>
                  <span className="text-[11px] text-slate-500">در نسخه آزمایشی هیچ تخصیص یا اعزامی انجام نمی‌شود</span>
                </span>
              </span>
              {selectedCleanerId === 'auto' && <span aria-hidden="true" className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>}
            </ChoiceCard>
            {CLEANERS_LIST.slice(0, 3).map((cl) => (
              <ChoiceCard
                key={cl.id}
                type="radio"
                name={`${fieldId}-cleaner`}
                checked={selectedCleanerId === cl.id}
                onChange={() => setSelectedCleanerId(cl.id)}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                  selectedCleanerId === cl.id ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <img src={cl.avatar} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                  <span className="block text-right">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      {cl.name}
                      <DemoSampleBadge />
                    </span>
                    <span className="text-[11px] text-slate-500">{cl.badge}</span>
                  </span>
                </span>
                {selectedCleanerId === cl.id && <span aria-hidden="true" className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>}
              </ChoiceCard>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-4 text-right">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${fieldId}-city`} className="block text-xs font-bold text-slate-700 mb-1">شهر:</label>
          <select
            id={`${fieldId}-city`}
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            {CITIES_DATA.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${fieldId}-district`} className="block text-xs font-bold text-slate-700 mb-1">منطقه / محله:</label>
          <select
            id={`${fieldId}-district`}
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            {(CITIES_DATA.find(c => c.name === cityName)?.districts || []).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${fieldId}-address`} className="block text-xs font-bold text-slate-700 mb-1">آدرس دقیق (خیابان، کوچه، پلاک):</label>
        <input
          id={`${fieldId}-address`}
          type="text"
          placeholder="مثال: بلوار دریا، خ صرافها، کوچه ۳۱، پلاک ۱۴"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label htmlFor={`${fieldId}-unit`} className="block text-xs font-bold text-slate-700 mb-1">طبقه و واحد:</label>
        <input
          id={`${fieldId}-unit`}
          type="text"
          placeholder="مثال: طبقه ۳، واحد ۸ (زنگ غربی)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div>
          <label htmlFor={`${fieldId}-name`} className="block text-xs font-bold text-slate-700 mb-1">نام و نام خانوادگی متقاضی:</label>
          <input
            id={`${fieldId}-name`}
            type="text"
            placeholder="مثال: سارا محمدی"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-phone`} className="block text-xs font-bold text-slate-700 mb-1">شماره همراه (تماس/هماهنگی در نسخه واقعی):</label>
          <input
            id={`${fieldId}-phone`}
            type="tel"
            dir="ltr"
            placeholder="0912xxxxxxx"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 text-left focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${fieldId}-notes`} className="block text-xs font-bold text-slate-700 mb-1">توضیحات و نکات خاص برای نیرو (اختیاری):</label>
        <textarea
          id={`${fieldId}-notes`}
          rows={2}
          placeholder="مثلا: دارای حیوان خانگی، تاکید روی تمیزکاری..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
        />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 text-right">
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Receipt className="w-4 h-4 text-emerald-600" />
            ریز پیش‌فاکتور رسمی پاک‌شو
          </span>
          <DemoBadge />
        </div>
        <div className="space-y-2 text-xs text-slate-700">
          <div className="flex justify-between">
            <span>{currentService.title} ({hours} ساعت):</span>
            <span className="font-mono">{baseServicePrice.toLocaleString('fa-IR')} ت</span>
          </div>

          {pakshoMode && serverQuote?.surcharges.map((line) => (
            <div key={`s-${line.id}`} className="flex justify-between text-amber-800">
              <span>هزینه جانبی:</span>
              <span className="font-mono">+{line.amount.toLocaleString('fa-IR')} ت</span>
            </div>
          ))}
          {pakshoMode && serverQuote?.discounts.map((line) => (
            <div key={`d-${line.id}`} className="flex justify-between text-emerald-600 font-bold border-t border-slate-200 pt-2">
              <span>{line.id.startsWith('promo:') ? 'کد تخفیف' : 'تخفیف تعرفه'}:</span>
              <span className="font-mono">-{line.amount.toLocaleString('fa-IR')} ت</span>
            </div>
          ))}
          {quoteError && <p className="text-[11px] font-bold text-rose-600">{quoteError}</p>}
        </div>
        <div className="pt-3 border-t border-slate-300 flex flex-col gap-2">
          <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 text-sm">{DEMO_COPY.provisionalPriceLabel}:</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-600 font-mono">{totalPrice.toLocaleString('fa-IR')}</span>
            <span className="text-xs text-slate-600">تومان</span>
          </div>
          </div>
          <ProvisionalPriceNote />
        </div>
      </div>
      {extrasOn && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
          <label htmlFor={`${fieldId}-promo`} className="block text-xs font-bold text-slate-700">کد تخفیف دارید؟</label>
          <div className="flex gap-2">
            <input
              id={`${fieldId}-promo`}
              type="text"
              placeholder="مثال: SAVE10"
              value={discountCodeInput}
              onChange={(e) => setDiscountCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleApplyDiscount();
                }
              }}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button type="button" onClick={handleApplyDiscount} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer">اعمال</button>
          </div>
          {discountMsg && <p className={`text-[11px] font-bold ${discountMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>{discountMsg.text}</p>}
          {appliedPromoCode && (
            <button type="button" onClick={handleRemoveDiscount} className="text-[11px] font-bold text-slate-600 underline hover:text-slate-900 cursor-pointer">
              حذف کد تخفیف {appliedPromoCode}
            </button>
          )}
        </div>
      )}
      {pakshoMode && otpSent && !customerToken && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
          <label htmlFor={`${fieldId}-otp`} className="block text-xs font-bold text-slate-700">کد پیامکی را وارد کنید:</label>
          <input
            id={`${fieldId}-otp`}
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}
      {pakshoMode && quoteError && <p className="text-[11px] font-bold text-rose-600">{quoteError}</p>}
      <div>
        <span id={`${fieldId}-payment`} className="block text-xs font-bold text-slate-700 mb-2">نحوه پرداخت:</span>
        <div role="radiogroup" aria-labelledby={`${fieldId}-payment`} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChoiceCard
            type="radio"
            name={`${fieldId}-payment`}
            checked={paymentMethod === 'cash_on_site'}
            onChange={() => setPaymentMethod('cash_on_site')}
            className={`block p-4 rounded-2xl border transition-all ${paymentMethod === 'cash_on_site' ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="w-4 h-4 rounded-full border border-emerald-600 flex items-center justify-center">
                {paymentMethod === 'cash_on_site' && <span className="w-2 h-2 bg-emerald-600 rounded-full" />}
              </span>
              <span className="text-xs font-bold text-slate-900">پرداخت در محل (نمایشی)</span>
            </span>
            <span className="block text-[11px] text-slate-500 mt-1 mr-6">{DEMO_COPY.paymentCashNotice}</span>
          </ChoiceCard>
          <ChoiceCard
            type="radio"
            name={`${fieldId}-payment`}
            checked={paymentMethod === 'online'}
            onChange={() => { if (ONLINE_PAYMENT_AVAILABLE) setPaymentMethod('online'); }}
            disabled={!ONLINE_PAYMENT_AVAILABLE}
            className="block p-4 rounded-2xl border border-slate-200 bg-slate-100/70 opacity-70"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center" />
              <span className="text-xs font-bold text-slate-500">پرداخت اینترنتی</span>
            </span>
            <span className="block text-[11px] text-slate-500 mt-1 mr-6">{DEMO_COPY.paymentOnlineDisabled}</span>
          </ChoiceCard>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh] outline-none"
      >
        
        {/* Modal Header */}
        <div className="p-5 sm:px-8 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-2">
              <DemoBadge />
              <span className="text-xs font-bold text-emerald-600">فرم آزمایشی رزرو</span>
            </div>
            <h3 id={titleId} className="text-lg sm:text-xl font-black text-slate-900 mt-1">ثبت درخواست خدمات نظافت</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps Indicator */}
        {!createdOrder && (
          <div className="px-5 sm:px-8 pt-4 pb-2 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between text-xs font-bold">
              {[
                { step: 1, title: '۱. نوع خدمت' },
                { step: 2, title: '۲. زمان و متخصص' },
                { step: 3, title: '۳. آدرس و تماس' },
                { step: 4, title: '۴. فاکتور و تایید' }
              ].map((s) => (
                <div
                  key={s.step}
                  aria-current={currentStep === s.step ? 'step' : undefined}
                  className={`flex items-center gap-1.5 pb-2 border-b-2 transition-all ${
                    currentStep === s.step ? 'border-emerald-600 text-emerald-700' : currentStep > s.step ? 'border-emerald-300 text-emerald-900' : 'border-transparent text-slate-500'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    currentStep === s.step ? 'bg-emerald-700 text-white' : currentStep > s.step ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {currentStep > s.step ? '✓' : s.step}
                  </span>
                  <span className="hidden sm:inline">{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleFormSubmitWrapper} className="flex-1 overflow-hidden flex flex-col">
          <div className="p-5 sm:p-8 overflow-y-auto flex-1 text-slate-800">
            {createdOrder ? renderSuccessScreen() : (
              <>
                <DemoInlineNotice text={DEMO_COPY.orderFlowNotice} className="mb-5" />
                {renderStepContent()}
              </>
            )}
          </div>

          {/* Bottom Nav / Error Banner */}
          {!createdOrder && (
            <div className="p-4 sm:px-8 border-t border-slate-200/80 bg-slate-50 flex flex-col gap-3 shrink-0">
              {formError && (
                <div role="alert" className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-2xl border border-rose-200 text-right animate-pulse">
                  ⚠️ {formError}
                </div>
              )}
              <div className="flex items-center justify-between">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => { setFormError(''); setCurrentStep(currentStep - 1); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 hover:bg-white text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>مرحله قبل</span>
                  </button>
                ) : (
                  <div />
                )}
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      // React همین گره‌ی DOM را در مرحله ۴ به دکمه‌ی type="submit" تبدیل می‌کند.
                      // مرورگر پس از اجرای همین کلیک «رفتار فعال‌سازی» دکمه را با type جدید
                      // اجرا می‌کرد و فرم را فوراً ثبت می‌کرد؛ یعنی مرحله‌ی فاکتور (کد تخفیف،
                      // روش پرداخت، تأیید نهایی) هرگز دیده نمی‌شد. preventDefault آن را لغو می‌کند.
                      event.preventDefault();
                      handleNextStep();
                    }}
                    onKeyDown={ignoreAutoRepeat}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <span>مرحله بعد</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    onClick={(event) => {
                      // کلیک دوم یک دوبار-کلیک (مثلاً روی «مرحله بعد» که همین‌جا بود) ثبت نمی‌کند؛
                      // ثبت فقط با یک کلیک جداگانه روی دکمه‌ی تأیید نهایی.
                      if (event.detail > 1) event.preventDefault();
                    }}
                    onKeyDown={ignoreAutoRepeat}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-black rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                  >
                    <span>{isSubmitting ? 'در حال ثبت...' : 'تایید نهایی و ثبت سفارش'}</span>
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </form>

      </div>
    </div>
  );
};