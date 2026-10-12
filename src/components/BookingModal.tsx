import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Check, ArrowLeft, ArrowRight,
  Sparkles, Tag, PackageCheck, CheckCircle2, Copy, Receipt
} from 'lucide-react';
import { SERVICES_LIST, ADDON_OPTIONS, CLEANERS_LIST, CITIES_DATA } from '../data/mockData';
import { ServiceType, CleanerGender, BookingOrder } from '../types';
import { CreateOrderDTO } from '../services/orderService.types';
import { PRICING_CONFIG, calculatePrice, validatePromoCode } from '../pricing/pricingEngine';
import { buildDemoOrderPayload } from '../services/demoOrder';
import { DemoBadge, DemoSampleBadge, DemoInlineNotice, ProvisionalPriceNote } from './DemoNotice';
import { DEMO_COPY, ONLINE_PAYMENT_AVAILABLE, CLEANER_ASSIGNMENT_AVAILABLE } from '../config/capabilities';

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
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('۰۹:۰۰ الی ۱۳:۰۰ (صبح)');
  const [selectedCleanerId, setSelectedCleanerId] = useState<string>('auto');

  // Address & Contact
  const [cityName, setCityName] = useState<string>('تهران');
  const [district, setDistrict] = useState<string>('سعادت‌آباد و شهرک غرب');
  const [address, setAddress] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
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

  // Success screen state
  const [createdOrder, setCreatedOrder] = useState<BookingOrder | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Reset & Hydrate States
  useEffect(() => {
    if (isOpen) {
      if (initialParams) {
        if (initialParams.serviceId) setServiceId(initialParams.serviceId);
        if (initialParams.cleanerGender) setCleanerGender(initialParams.cleanerGender);
        if (initialParams.hours) setHours(initialParams.hours);
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
      setSelectedTimeSlot('۰۹:۰۰ الی ۱۳:۰۰ (صبح)');
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
  }, [cityName]);if (!isOpen) return null;

  const currentService = SERVICES_LIST.find(s => s.id === serviceId) || SERVICES_LIST[0];

  // محاسبه قیمت از موتور مشترک قیمت‌گذاری — دقیقاً همان تابعی که محاسبه‌گر
  // هزینه استفاده می‌کند، بنابراین مبلغ فاکتور با مبلغ نمایش‌داده‌شده در
  // محاسبه‌گر همیشه یکسان است.
  const pricing = useMemo(
    () =>
      calculatePrice({
        serviceId,
        hours,
        addonIds: selectedAddons,
        hasDetergentPackage,
        promoCode: appliedPromoCode || undefined,
      }),
    [serviceId, hours, selectedAddons, hasDetergentPackage, appliedPromoCode],
  );

  const addonsPrice = pricing.addonsTotal;
  const detergentPrice = pricing.detergentCost;
  const baseServicePrice = pricing.serviceBase;
  const totalPrice = pricing.total;

  // Handlers
  const handleApplyDiscount = () => {
    const code = discountCodeInput.trim().toUpperCase();
    if (!code) return;

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
    if (!address.trim() || !customerName.trim() || !customerPhone.trim()) {
      setFormError('لطفاً آدرس دقیق، نام و شماره همراه را تکمیل فرمایید.');
      return false;
    }
    const phoneRegex = /^09\d{9}$/;
    if (!phoneRegex.test(customerPhone.trim())) {
      setFormError('لطفاً شماره همراه معتبر ۱۱ رقمی (مثال: 09123456789) وارد کنید.');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 3 && !validateStep3()) return;
    setFormError('');
    setCurrentStep(prev => prev + 1);
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
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
      customerPhone: customerPhone.trim(),
      notes: notes.trim(),
      totalPrice,
      discountApplied: pricing.discountsTotal,
      requestedCleanerId: requestedCleaner?.id,
      requestedCleanerName: requestedCleaner?.name,
    });

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
        message.includes('حافظه')
          ? 'ذخیره‌سازی محلی مرورگر ناموفق بود؛ درخواست آزمایشی ثبت نشد.'
          : 'ثبت درخواست آزمایشی ناموفق بود. مجدداً تلاش فرمایید.',
      );
    } finally {
      setIsSubmitting(false);
    }
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
          <span className="text-xs text-slate-400 block">کد پیگیری آزمایشی:</span>
          <div className="flex items-center justify-center gap-3 bg-slate-800 p-3 rounded-2xl border border-slate-700">
            <span className="text-xl font-black font-mono text-emerald-400 tracking-wider">{createdOrder.trackingCode}</span>
            <button
              type="button"
              onClick={handleCopyTrackingCode}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
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
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 text-sm transition-colors cursor-pointer"
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
        <label className="block text-xs font-bold text-slate-700 mb-2">نوع خدمت نظافت مورد نظر:</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SERVICES_LIST.map((srv) => (
            <div
              key={srv.id}
              onClick={() => {
                setServiceId(srv.id);
                if (hours < srv.minHours) setHours(srv.minHours);
              }}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                serviceId === srv.id ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-slate-900 block">{srv.title}</span>
                <span className="text-[11px] text-slate-500 font-mono">{srv.baseHourlyRate.toLocaleString('fa-IR')} ت / ساعت</span>
              </div>
              {serviceId === srv.id && <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">✓</span>}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
          <span>تعداد ساعت کار نیرو:</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono text-sm">{hours} ساعت</span>
        </div>
        <input
          type="range"
          min={currentService.minHours}
          max={12}
          step={1}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2">اولویت جنسیت متخصص نظافت:</label>
        <div className="grid grid-cols-3 gap-2">
          {[{ id: 'female', label: 'خانم' }, { id: 'male', label: 'آقا' }, { id: 'no-pref', label: 'تفاوتی ندارد' }].map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => setCleanerGender(g.id as CleanerGender)}
              className={`py-2.5 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                cleanerGender === g.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              نظافتچی {g.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700 mb-1">خدمات جانبی (اختیاری):</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ADDON_OPTIONS.filter(a => a.id !== 'detergents').map(addon => {
            const checked = selectedAddons.includes(addon.id);
            return (
              <div
                key={addon.id}
                onClick={() => setSelectedAddons(prev => checked ? prev.filter(x => x !== addon.id) : [...prev, addon.id])}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  checked ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 block">{addon.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono">+{addon.price.toLocaleString('fa-IR')} ت</span>
                </div>
                <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>
                  {checked && <Check className="w-3 h-3" />}
                </div>
              </div>
            );
          })}
        </div>
        <div
          onClick={() => setHasDetergentPackage(!hasDetergentPackage)}
          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between mt-2 ${
            hasDetergentPackage ? 'bg-teal-50 border-teal-500' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-teal-600" />
            <div className="text-right">
              <span className="text-xs font-bold text-slate-900 block">تامین شوینده‌ها و دستمال نانو توسط متخصص</span>
              <span className="text-[10px] text-slate-500">
                (+{PRICING_CONFIG.detergentPackagePrice.toLocaleString('fa-IR')} ت - جرم‌گیر، وایتکس، شیشه‌پاک‌کن، دستمال نانو)
              </span>
            </div>
          </div>
          <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${hasDetergentPackage ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300'}`}>
            {hasDetergentPackage && <Check className="w-3 h-3" />}
          </div>
        </div>
      </div>
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
    const timeSlots = [
      '۰۸:۳۰ الی ۱۲:۳۰ (صبح زود)',
      '۱۲:۳۰ الی ۱۶:۳۰ (ظهر و بعدازظهر)',
      '۱۶:۳۰ الی ۲۰:۳۰ (عصر و غروب)'
    ];
    return (
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">روز مراجعه نیروی خدماتی:</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {dates.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDate(d.id)}
                className={`p-3 text-right rounded-2xl border transition-all cursor-pointer ${
                  selectedDate === d.id ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`text-xs font-bold block ${selectedDate === d.id ? 'text-emerald-900' : 'text-slate-800'}`}>{d.label}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">{d.sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">بازه زمانی شروع کار:</label>
          <div className="space-y-2">
            {timeSlots.map((slot) => (
              <div
                key={slot}
                onClick={() => setSelectedTimeSlot(slot)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedTimeSlot === slot ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold text-slate-800">{slot}</span>
                {selectedTimeSlot === slot && <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">انتخاب متخصص (فهرست نمونه):</label>
          <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
            {CLEANER_ASSIGNMENT_AVAILABLE
              ? 'انتخاب شما به موتور تخصیص سرور پاک‌شو ارسال می‌شود.'
              : 'پروفایل‌های زیر نمونه هستند. در نسخه آزمایشی هیچ متخصصی تخصیص داده نمی‌شود؛ انتخاب شما فقط به‌عنوان «درخواست» ثبت می‌شود.'}
          </p>
          <div className="space-y-2">
            <div
              onClick={() => setSelectedCleanerId('auto')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedCleanerId === 'auto' ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 block">بدون اولویت خاص (پیشنهادی)</span>
                  <span className="text-[11px] text-slate-500">در نسخه آزمایشی هیچ تخصیص یا اعزامی انجام نمی‌شود</span>
                </div>
              </div>
              {selectedCleanerId === 'auto' && <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>}
            </div>
            {CLEANERS_LIST.slice(0, 3).map((cl) => (
              <div
                key={cl.id}
                onClick={() => setSelectedCleanerId(cl.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedCleanerId === cl.id ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img src={cl.avatar} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      {cl.name}
                      <DemoSampleBadge />
                    </span>
                    <span className="text-[11px] text-slate-500">{cl.badge}</span>
                  </div>
                </div>
                {selectedCleanerId === cl.id && <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>}
              </div>
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
          <label className="block text-xs font-bold text-slate-700 mb-1">شهر:</label>
          <select
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none"
          >
            {CITIES_DATA.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">منطقه / محله:</label>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none"
          >
            {(CITIES_DATA.find(c => c.name === cityName)?.districts || []).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">آدرس دقیق (خیابان، کوچه، پلاک):</label>
        <input
          type="text"
          placeholder="مثال: بلوار دریا، خ صرافها، کوچه ۳۱، پلاک ۱۴"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">طبقه و واحد:</label>
        <input
          type="text"
          placeholder="مثال: طبقه ۳، واحد ۸ (زنگ غربی)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">نام و نام خانوادگی متقاضی:</label>
          <input
            type="text"
            placeholder="مثال: سارا محمدی"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">شماره همراه (تماس/هماهنگی در نسخه واقعی):</label>
          <input
            type="tel"
            dir="ltr"
            placeholder="0912xxxxxxx"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 text-left focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات و نکات خاص برای نیرو (اختیاری):</label>
        <textarea
          rows={2}
          placeholder="مثلا: دارای حیوان خانگی، تاکید روی تمیزکاری..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm text-slate-800 focus:outline-none"
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
          {addonsPrice > 0 && (
            <div className="flex justify-between text-amber-800">
              <span>خدمات جانبی انتخابی:</span>
              <span className="font-mono">+{addonsPrice.toLocaleString('fa-IR')} ت</span>
            </div>
          )}
          {hasDetergentPackage && (
            <div className="flex justify-between text-teal-800">
              <span>پکیج مواد شوینده و دستمال نانو:</span>
              <span className="font-mono">+{detergentPrice.toLocaleString('fa-IR')} ت</span>
            </div>
          )}
          {pricing.discountLines.map((line) => (
            <div key={line.id} className="flex justify-between text-emerald-600 font-bold border-t border-slate-200 pt-2">
              <span>{line.title}:</span>
              <span className="font-mono">-{line.amount.toLocaleString('fa-IR')} ت</span>
            </div>
          ))}
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-emerald-600" />
          کد تخفیف دارید؟
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="مثال: PAK1403"
            value={discountCodeInput}
            onChange={(e) => setDiscountCodeInput(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs sm:text-sm font-mono uppercase focus:outline-none"
          />
          <button type="button" onClick={handleApplyDiscount} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer">اعمال</button>
        </div>
        {discountMsg && <p className={`text-[11px] font-bold ${discountMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>{discountMsg.text}</p>}
        {appliedPromoCode && (
          <button
            type="button"
            onClick={handleRemoveDiscount}
            className="text-[11px] font-bold text-slate-600 underline hover:text-slate-900 cursor-pointer"
          >
            حذف کد تخفیف {appliedPromoCode}
          </button>
        )}
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2">نحوه پرداخت:</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => setPaymentMethod('cash_on_site')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${paymentMethod === 'cash_on_site' ? 'bg-emerald-50 border-emerald-600 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-emerald-600 flex items-center justify-center">
                {paymentMethod === 'cash_on_site' && <span className="w-2 h-2 bg-emerald-600 rounded-full" />}
              </span>
              <span className="text-xs font-bold text-slate-900">پرداخت در محل (نمایشی)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 mr-6">{DEMO_COPY.paymentCashNotice}</p>
          </div>
          <div
            aria-disabled={!ONLINE_PAYMENT_AVAILABLE}
            className="p-4 rounded-2xl border border-slate-200 bg-slate-100/70 opacity-70 cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center" />
              <span className="text-xs font-bold text-slate-500">پرداخت اینترنتی</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 mr-6">{DEMO_COPY.paymentOnlineDisabled}</p>
          </div>
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
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-5 sm:px-8 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-2">
              <DemoBadge />
              <span className="text-xs font-bold text-emerald-600">فرم آزمایشی رزرو</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1">ثبت درخواست خدمات نظافت</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
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
                  className={`flex items-center gap-1.5 pb-2 border-b-2 transition-all ${
                    currentStep === s.step ? 'border-emerald-600 text-emerald-700' : currentStep > s.step ? 'border-emerald-300 text-emerald-900' : 'border-transparent text-slate-400'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    currentStep === s.step ? 'bg-emerald-600 text-white' : currentStep > s.step ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
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
                <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-2xl border border-rose-200 text-right animate-pulse">
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
                    onClick={handleNextStep}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <span>مرحله بعد</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
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