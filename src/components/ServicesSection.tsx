import React, { useState } from 'react';
import { 
  Home, 
  Sparkles, 
  Building2, 
  Layers, 
  Armchair, 
  HardHat, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowLeft,
  Info,
  CalendarCheck
} from 'lucide-react';
import { SERVICES_LIST } from '../data/mockData';
import { ServiceItem } from '../types';

interface ServicesSectionProps {
  onSelectServiceForBooking: (serviceId: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  onSelectServiceForBooking
}) => {
  const [selectedServiceDetail, setSelectedServiceDetail] = useState<ServiceItem | null>(null);

  const getServiceIcon = (iconName: string) => {
    switch (iconName) {
      case 'Home':
        return <Home className="w-6 h-6" />;
      case 'Sparkles':
        return <Sparkles className="w-6 h-6" />;
      case 'Building2':
        return <Building2 className="w-6 h-6" />;
      case 'Layers':
        return <Layers className="w-6 h-6" />;
      case 'Armchair':
        return <Armchair className="w-6 h-6" />;
      case 'HardHat':
        return <HardHat className="w-6 h-6" />;
      default:
        return <Sparkles className="w-6 h-6" />;
    }
  };

  return (
    <section id="services" className="py-16 sm:py-20 bg-slate-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>پوشش کامل نیازهای نظافتی شما</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            خدمات و تعرفه‌های پیشنهادی پاک‌شو
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            در این نسخه آزمایشی می‌توانید انواع خدمات نظافت و برآوردهای پیشنهادی را مشاهده کنید؛ آموزش نیروها و کیفیت تجهیزات هنوز تأیید نشده است.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {SERVICES_LIST.map((service) => (
            <div
              key={service.id}
              className="group bg-white rounded-3xl overflow-hidden border border-slate-200/80 hover:border-emerald-500/40 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              {/* Image banner & tag */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={service.bannerImage}
                  alt={service.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                
                {service.popular && (
                  <span className="absolute top-3 right-3 bg-emerald-500 text-slate-950 text-[11px] font-black px-2.5 py-1 rounded-full shadow-md">
                    پرتقاضا و محبوب
                  </span>
                )}

                <div className="absolute bottom-3 right-3 left-3 flex items-center gap-2.5 text-white">
                  <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-emerald-300">
                    {getServiceIcon(service.iconName)}
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    {service.title}
                  </h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  {service.shortDesc}
                </p>

                {/* Included features preview */}
                <div className="space-y-2 py-3 border-y border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 block">
                    برخی از اقلام شامل این خدمت:
                  </span>
                  <div className="space-y-1.5">
                    {service.included.slice(0, 3).map((inc, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{inc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price & Actions */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block">تعرفه ساعتی:</span>
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {service.baseHourlyRate.toLocaleString('fa-IR')}{' '}
                        <small className="text-xs font-normal text-slate-500">تومان</small>
                      </span>
                    </div>
                    <div className="text-left text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>حداقل {service.minHours} ساعت</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedServiceDetail(service)}
                      className="py-2.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span>جزئیات خدمت</span>
                    </button>
                    <button
                      onClick={() => onSelectServiceForBooking(service.id)}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                      <span>رزرو این خدمت</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Service Detail Modal */}
      {selectedServiceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="relative h-44 shrink-0 overflow-hidden">
              <img
                src={selectedServiceDetail.bannerImage}
                alt={selectedServiceDetail.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
              <button
                onClick={() => setSelectedServiceDetail(null)}
                className="absolute top-4 left-4 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-all cursor-pointer"
                aria-label="بستن"
              >
                ✕
              </button>
              <div className="absolute bottom-4 right-4 text-white">
                <span className="text-xs bg-emerald-500 text-slate-950 font-black px-2.5 py-0.5 rounded-full mb-1 inline-block">
                  جزئیات شفاف
                </span>
                <h3 className="text-xl font-black">
                  {selectedServiceDetail.title}
                </h3>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <p className="text-slate-700 leading-relaxed">
                {selectedServiceDetail.fullDesc}
              </p>

              {/* What's Included */}
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 space-y-2.5">
                <h4 className="font-bold text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  شامل چه مواردی است؟
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-emerald-900">
                  {selectedServiceDetail.included.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* What's Excluded */}
              <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-4 space-y-2.5">
                <h4 className="font-bold text-rose-950 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  شامل چه مواردی نمی‌شود؟ (یا نیاز به سفارش اختصاصی دارد)
                </h4>
                <ul className="space-y-1.5 text-xs text-rose-900">
                  {selectedServiceDetail.excluded.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pricing breakdown */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-100 text-slate-800">
                <div>
                  <span className="text-xs text-slate-500 block">نرخ پایه پیشنهادی (آزمایشی):</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    {selectedServiceDetail.baseHourlyRate.toLocaleString('fa-IR')} تومان در ساعت
                  </span>
                </div>
                <div className="text-left text-xs text-slate-600">
                  <span className="block">حداقل زمان: {selectedServiceDetail.minHours} ساعت</span>
                  <span className="text-emerald-700 font-bold">بدون انعام اجباری</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setSelectedServiceDetail(null)}
                className="py-2.5 px-4 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  const sId = selectedServiceDetail.id;
                  setSelectedServiceDetail(null);
                  onSelectServiceForBooking(sId);
                }}
                className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
              >
                <span>رزرو آنلاین این خدمت</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
