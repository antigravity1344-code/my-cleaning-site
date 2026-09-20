import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  Star, 
  Users, 
  ArrowLeft, 
  MapPin, 
  UserCheck, 
  Layers
} from 'lucide-react';
import { SERVICES_LIST, CITIES_DATA } from '../data/mockData';
import { ServiceType, CleanerGender } from '../types';

interface HeroProps {
  onStartBookingWithParams: (params: {
    serviceId: ServiceType;
    cleanerGender: CleanerGender;
    hours: number;
    cityName: string;
  }) => void;
  onOpenAiConsultant: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onStartBookingWithParams,
  onOpenAiConsultant
}) => {
  const [selectedService, setSelectedService] = useState<ServiceType>('home-standard');
  const [selectedGender, setSelectedGender] = useState<CleanerGender>('female');
  const [selectedHours, setSelectedHours] = useState<number>(4);
  const [selectedCity, setSelectedCity] = useState<string>('تهران');

  const currentServiceObj = SERVICES_LIST.find(s => s.id === selectedService) || SERVICES_LIST[0];
  const calculatedBasePrice = currentServiceObj.baseHourlyRate * selectedHours;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartBookingWithParams({
      serviceId: selectedService,
      cleanerGender: selectedGender,
      hours: selectedHours,
      cityName: selectedCity
    });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-emerald-900/5 via-teal-900/5 to-slate-50 pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Decorative background blurs */}
      <div className="absolute top-0 right-1/4 -z-10 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 -z-10 w-80 h-80 bg-teal-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Value Proposition & Highlights */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Trust Pill */}
            <div className="inline-flex items-center gap-2 bg-emerald-100/80 border border-emerald-200 px-3.5 py-1.5 rounded-full text-emerald-900 text-xs sm:text-sm font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
              <span>سامانه منتخب خدمات نظافت منزل و محل کار با تضمین ۱۰۰٪ کیفیت</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.25] tracking-tight">
              نظافتی درخشان و بی‌نقص،{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700">
                با نیروهای مجرب و معتمد
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl">
              تنها با چند کلیک، متخصصین تایید صلاحیت‌شده و بیمه‌شده نظافت را به خانه یا محل کار خود دعوت کنید. تعرفه شفاف، حضور سروقت و گارانتی بازگشت وجه در صورت عدم رضایت.
            </p>

            {/* Reassurance Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800">احراز هویت کامل</p>
                  <p className="text-slate-500 text-[11px]">گواهی عدم سوءپیشینه</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800">گارانتی ۱۰۰٪ رضایت</p>
                  <p className="text-slate-500 text-[11px]">تجدید رایگان نظافت</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800">اعزام فوری و به‌موقع</p>
                  <p className="text-slate-500 text-[11px]">در کمتر از ۲ ساعت</p>
                </div>
              </div>
            </div>

            {/* Smart Consultant Banner */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-teal-800 to-slate-900 text-white shadow-md">
              <div className="space-y-1">
                <p className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  نمی‌دانید به چند ساعت نظافت نیاز دارید؟
                </p>
                <p className="text-xs text-slate-300">
                  مشاور هوشمند پاک‌شو بر اساس متراژ و نوع منزل شما، زمان و تعداد نیرو را تخمین می‌زند.
                </p>
              </div>
              <button
                onClick={onOpenAiConsultant}
                className="shrink-0 mr-3 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer active:scale-95"
              >
                مشاوره هوشمند
              </button>
            </div>

            {/* Customer Trust Stats */}
            <div className="pt-2 flex items-center gap-6 text-slate-600 text-xs sm:text-sm border-t border-slate-200/60">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                <span><strong>+۲۵,۰۰۰</strong> مشتری راضی</span>
              </div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-teal-600" />
                <span><strong>+۴۵۰</strong> متخصص تایید شده</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span>امتیاز <strong>۴.۹</strong> از ۵</span>
              </div>
            </div>

          </div>

          {/* Right Column: Interactive Quick Booking Widget */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 relative">
              
              {/* Card Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    استعلام قیمت و رزرو فوری
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تخمین دقیق هزینه بدون نیاز به ثبت‌نام اولیه
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              {/* Booking Form */}
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                
                {/* City selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    انتخاب شهر
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  >
                    {CITIES_DATA.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Service Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    نوع خدمت
                  </label>
                  <select
                    value={selectedService}
                    onChange={(e) => {
                      const newService = e.target.value as ServiceType;
                      setSelectedService(newService);
                      const s = SERVICES_LIST.find(x => x.id === newService);
                      if (s && selectedHours < s.minHours) {
                        setSelectedHours(s.minHours);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all truncate"
                    title={currentServiceObj.title}
                  >
                    {SERVICES_LIST.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.baseHourlyRate.toLocaleString('fa-IR')} ت/ساعت)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cleaner Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    جنسیت نیروی خدماتی
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedGender('female')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        selectedGender === 'female'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      نظافتچی خانم
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGender('male')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        selectedGender === 'male'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      نظافتچی آقا
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGender('no-pref')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        selectedGender === 'no-pref'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      فرقی ندارد
                    </button>
                  </div>
                </div>

                {/* Hours Slider / Selector */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span>مدت زمان مورد نیاز:</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono text-sm">
                      {selectedHours} ساعت
                    </span>
                  </div>
                  <input
                    type="range"
                    min={currentServiceObj.minHours}
                    max={12}
                    step={1}
                    value={selectedHours}
                    onChange={(e) => setSelectedHours(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>حداقل {currentServiceObj.minHours} ساعت</span>
                    <span>۸ ساعت (یک روز کاری کامل)</span>
                    <span>۱۲ ساعت</span>
                  </div>
                </div>

                {/* Price Display Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-between shadow-inner">
                  <div>
                    <span className="text-xs text-slate-300 block">هزینه پایه تخمینی:</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                        {calculatedBasePrice.toLocaleString('fa-IR')}
                      </span>
                      <span className="text-xs text-slate-300">تومان</span>
                    </div>
                  </div>
                  <div className="text-left text-[11px] text-slate-300 bg-white/10 px-2.5 py-1.5 rounded-lg">
                    <span>شامل بیمه و گارانتی</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 transition-all cursor-pointer text-sm sm:text-base active:scale-98"
                >
                  <span>ادامه و انتخاب تاریخ و آدرس</span>
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <p className="text-center text-[11px] text-slate-400">
                  بدون پرداخت در این مرحله • امکان پرداخت در محل پس از رضایت
                </p>

              </form>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
