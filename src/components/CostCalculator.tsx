import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, Sparkles, PackageCheck, ArrowLeft, Check, Percent 
} from 'lucide-react';
import { SERVICES_LIST, ADDON_OPTIONS, getServiceCategory, getAddonsForCategory } from '../data/mockData';
import { ServiceType, CleanerGender } from '../types';

const PRICING_CONFIG = {
  detergentPackagePrice: 140000,
  onlineDiscountPercent: 0.05, // ۵ درصد تخفیف رزرو آنلاین
};

interface CostCalculatorProps {
  onProceedToBooking: (calcData: {
    serviceId: ServiceType;
    hours: number;
    squareMeters: number;
    roomsCount: number;
    selectedAddons: string[];
    hasDetergentPackage: boolean;
    cleanerGender: CleanerGender;
    totalPrice: number;
  }) => void;
}

export const CostCalculator: React.FC<CostCalculatorProps> = ({
  onProceedToBooking
}) => {
  const [serviceId, setServiceId] = useState<ServiceType>('home-standard');
  const [squareMeters, setSquareMeters] = useState<number>(95);
  const [roomsCount, setRoomsCount] = useState<number>(2);
  const [bathroomsCount, setBathroomsCount] = useState<number>(1);
  const [cleanerGender, setCleanerGender] = useState<CleanerGender>('no-pref');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [hasDetergentPackage, setHasDetergentPackage] = useState<boolean>(true);

  const currentService = SERVICES_LIST.find(s => s.id === serviceId) || SERVICES_LIST[0];

  const serviceCategory = currentService.category ?? getServiceCategory(serviceId);
  const isCleaning = serviceCategory === 'cleaning';
  const availableAddons = getAddonsForCategory(serviceCategory).filter(a => a.id !== 'detergents');
  const genderPrefix =
    serviceCategory === 'painting' ? 'نقاش' :
    serviceCategory === 'labor' ? 'کارگر' :
    'نظافتچی';

  useEffect(() => {
    const cat = getServiceCategory(serviceId);
    const allowed = new Set(getAddonsForCategory(cat).map(a => a.id));
    setSelectedAddons(prev => prev.filter(id => allowed.has(id)));
    if (cat !== 'cleaning') setHasDetergentPackage(false);
  }, [serviceId]);

  // Calculate recommended hours based on inputs
  const recommendedHours = useMemo(() => {
    let baseH = 4;
    if (squareMeters <= 60) baseH = 4;
    else if (squareMeters <= 90) baseH = 4;
    else if (squareMeters <= 130) baseH = 5;
    else if (squareMeters <= 170) baseH = 6;
    else if (squareMeters <= 220) baseH = 7;
    else baseH = 8;

    // Labor: lighter estimate — skip bathroom/room inflation so hours stay realistic
    if (serviceId === 'hourly-worker') {
      if (squareMeters > 150) baseH = Math.min(baseH, 5);
      else baseH = Math.min(baseH, 4);
      return Math.max(currentService.minHours, Math.min(10, baseH));
    }

    if (isCleaning) {
      if (roomsCount >= 3) baseH += 1;
      if (bathroomsCount >= 2) baseH += 1;
    } else if (serviceCategory === 'painting') {
      // rooms help a bit for painting area, bathrooms less relevant
      if (roomsCount >= 3) baseH += 1;
    }

    if (serviceId === 'home-deep') baseH += 2;
    if (serviceId === 'post-construction') baseH += 2;
    if (serviceId === 'building-painting') baseH += 2;

    return Math.max(currentService.minHours, Math.min(12, baseH));
  }, [squareMeters, roomsCount, bathroomsCount, serviceId, currentService.minHours, isCleaning, serviceCategory]);

  // Calculate total price
  const calculation = useMemo(() => {
    const serviceBase = currentService.baseHourlyRate * recommendedHours;
    
    let addonsTotal = 0;
    selectedAddons.forEach(addonId => {
      const found = ADDON_OPTIONS.find(a => a.id === addonId);
      if (found) addonsTotal += found.price;
    });

    const detergentCost = (isCleaning && hasDetergentPackage) ? PRICING_CONFIG.detergentPackagePrice : 0;
    const subtotal = serviceBase + addonsTotal + detergentCost;
    
    const autoDiscount = Math.round(subtotal * PRICING_CONFIG.onlineDiscountPercent / 1000) * 1000;
    const finalTotal = subtotal - autoDiscount;

    return {
      serviceBase,
      addonsTotal,
      detergentCost,
      subtotal,
      autoDiscount,
      finalTotal
    };
  }, [currentService, recommendedHours, selectedAddons, hasDetergentPackage, isCleaning]);

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBook = () => {
    onProceedToBooking({
      serviceId,
      hours: recommendedHours,
      squareMeters,
      roomsCount,
      selectedAddons,
      hasDetergentPackage: isCleaning && hasDetergentPackage,
      cleanerGender,
      totalPrice: calculation.finalTotal
    });
  };return (
    <section id="calculator" className="py-16 sm:py-20 bg-white border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <Calculator className="w-3.5 h-3.5 text-emerald-600" />
            <span>شفافیت کامل در قیمت‌گذاری</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            محاسبه‌گر آنلاین و تخمین آنی هزینه
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            مشخصات منزل یا محل کار خود را تنظیم کنید تا مدت زمان بهینه و هزینه دقیق بدون هیچ هزینه پنهانی برایتان محاسبه شود.
          </p>
        </div>

        {/* Calculator Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Controls Config (8 cols) */}
          <div className="lg:col-span-7 bg-slate-50/80 rounded-3xl p-6 sm:p-8 border border-slate-200/80 space-y-6">
            
            {/* Service Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ۱. نوع خدمت را انتخاب کنید:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SERVICES_LIST.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    className={`p-3 text-right rounded-2xl border transition-all cursor-pointer ${
                      serviceId === s.id
                        ? 'bg-emerald-50 border-emerald-600 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`text-xs font-bold block ${serviceId === s.id ? 'text-emerald-900' : 'text-slate-800'}`}>
                      {s.title}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                      {s.baseHourlyRate.toLocaleString('fa-IR')} ت/ساعت
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Square meters Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                <span>۲. متراژ تقریبی فضا:</span>
                <span className="bg-emerald-600 text-white font-mono text-sm px-3 py-0.5 rounded-lg shadow-xs">
                  {squareMeters} متر مربع
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={300}
                step={5}
                value={squareMeters}
                onChange={(e) => setSquareMeters(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
                <span>کوچک (۴۰ تا ۷۰ متر)</span>
                <span>متوسط (۸۰ تا ۱۲۰ متر)</span>
                <span>بزرگ (۱۳۰ تا ۳۰۰+ متر)</span>
              </div>
            </div>

            {/* Rooms and Bathrooms count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Rooms */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  تعداد اتاق خواب‌ها:
                </label>
                <div className="flex items-center justify-between">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRoomsCount(num)}
                      className={`w-9 h-9 rounded-xl font-bold font-mono text-sm transition-all cursor-pointer ${
                        roomsCount === num
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {num === 5 ? '+۵' : num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bathrooms */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  تعداد سرویس بهداشتی / حمام:
                </label>
                <div className="flex items-center justify-between">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setBathroomsCount(num)}
                      className={`w-9 h-9 rounded-xl font-bold font-mono text-sm transition-all cursor-pointer ${
                        bathroomsCount === num
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {num === 4 ? '+۴' : num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cleaner Gender */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ۳. اولویت جنسیت متخصص:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCleanerGender('female')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    cleanerGender === 'female'
                      ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  {genderPrefix}{' '}خانم
                </button>
                <button
                  type="button"
                  onClick={() => setCleanerGender('male')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    cleanerGender === 'male'
                      ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  {genderPrefix}{' '}آقا
                </button>
                <button
                  type="button"
                  onClick={() => setCleanerGender('no-pref')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    cleanerGender === 'no-pref'
                      ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  اولویت ندارد
                </button>
              </div>
            </div>

            {/* Optional Add-ons */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ۴. خدمات جانبی{isCleaning ? ' و شوینده' : ''} (اختیاری):
              </label>
              <div className="space-y-2">
                {availableAddons.map(addon => {
                  const isChecked = selectedAddons.includes(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked 
                          ? 'bg-emerald-50/80 border-emerald-500 shadow-xs' 
                          : 'bg-white border-slate-200 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-800 block">
                            {addon.title}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {addon.description}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono text-emerald-700 shrink-0 mr-2">
                        +{addon.price.toLocaleString('fa-IR')} ت
                      </span>
                    </div>
                  );
                })}

                {/* Detergent package toggle — cleaning only */}
                {isCleaning && (
                <div
                  onClick={() => setHasDetergentPackage(!hasDetergentPackage)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    hasDetergentPackage 
                      ? 'bg-teal-50 border-teal-500 shadow-xs' 
                      : 'bg-white border-slate-200 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      hasDetergentPackage ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {hasDetergentPackage && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <PackageCheck className="w-4 h-4 text-teal-600" />
                        تامین کامل شوینده‌ها و دستمال نانو توسط نیرو
                      </span>
                      <span className="text-[11px] text-slate-500">
                        (شامل جرم‌گیر، وایتکس معطر، شیشه‌پاک‌کن، گازپاک‌کن و ۴ عدد دستمال نانو)
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-teal-800 shrink-0 mr-2">
                    +{PRICING_CONFIG.detergentPackagePrice.toLocaleString('fa-IR')} ت
                  </span>
                </div>
                )}

              </div>
            </div>

          </div>

          {/* Live Summary & Checkout Card (5 cols) */}
          <div className="lg:col-span-5 sticky top-28">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="text-right">
                  <h3 className="text-lg font-black text-white">
                    پیش‌فاکتور شفاف سفارش
                  </h3>
                  <p className="text-xs text-slate-400">
                    محاسبه هوشمند بر اساس پارامترهای انتخابی
                  </p>
                </div>
                <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>

              {/* Specs breakdown */}
              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span>خدمت انتخاب‌شده:</span>
                  <span className="font-bold text-white">{currentService.title}</span>
                </div>
                
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span>مدت زمان تخمینی پیشنهادی:</span>
                  <span className="font-bold font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    {recommendedHours} ساعت کاری
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span>هزینه پایه زمان ({recommendedHours} ساعت × {currentService.baseHourlyRate.toLocaleString('fa-IR')}):</span>
                  <span className="font-mono">{calculation.serviceBase.toLocaleString('fa-IR')} ت</span>
                </div>

                {calculation.addonsTotal > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span>هزینه خدمات جانبی انتخابی:</span>
                    <span className="font-mono text-amber-300">+{calculation.addonsTotal.toLocaleString('fa-IR')} ت</span>
                  </div>
                )}

                {isCleaning && hasDetergentPackage && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                    <span>پکیج مواد شوینده و دستمال:</span>
                    <span className="font-mono text-teal-300">+{calculation.detergentCost.toLocaleString('fa-IR')} ت</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5" />
                    تخفیف آنلاین پاک‌شو ({ (PRICING_CONFIG.onlineDiscountPercent * 100).toLocaleString('fa-IR') }٪):
                  </span>
                  <span className="font-mono">-{calculation.autoDiscount.toLocaleString('fa-IR')} ت</span>
                </div>
              </div>

              {/* Total final amount */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">مبلغ نهایی قابل پرداخت:</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                      {calculation.finalTotal.toLocaleString('fa-IR')}
                    </span>
                    <span className="text-xs text-slate-300">تومان</span>
                  </div>
                </div>
                <div className="text-left text-[11px] text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2 py-1 rounded-lg">
                  <span>تضمین کمترین قیمت</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleBook}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer text-sm sm:text-base active:scale-98"
              >
                <span>ثبت و تکمیل رزرو با این مشخصات</span>
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="space-y-1.5 text-[11px] text-slate-400 text-center">
                <p>✓ امکان تغییر مشخصات تا ۲ ساعت قبل از اعزام</p>
                <p>✓ پرداخت پس از رضایت از کیفیت کار در محل</p>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};