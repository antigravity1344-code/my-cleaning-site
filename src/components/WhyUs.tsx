import React from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  FileText, 
  Headphones, 
  BadgeCheck, 
  CreditCard,
  HeartHandshake
} from 'lucide-react';

export const WhyUs: React.FC = () => {
  const guarantees = [
    {
      icon: <ShieldCheck className="w-7 h-7 text-emerald-600" />,
      title: 'احراز هویت ۱۰ مرحله‌ای و عدم سوءپیشینه',
      desc: 'تمامی متخصصین پس از بررسی کامل هویتی، استعلام قضایی، سابقه سکونت و مصاحبه روان‌شناختی وارد سامانه می‌شوند.'
    },
    {
      icon: <RefreshCw className="w-7 h-7 text-teal-600" />,
      title: 'گارانتی ۱۰۰٪ رضایت یا اعزام نیروی مجدد',
      desc: 'اگر در ساعت اول نظافت از عملکرد نیرو رضایت نداشتید، نیرو بدون دریافت وجه تعویض می‌شود یا نظافت رایگان تکرار خواهد شد.'
    },
    {
      icon: <FileText className="w-7 h-7 text-blue-600" />,
      title: 'پوشش کامل بیمه حوادث و مسئولیت',
      desc: 'تمام طول مدت حضور نیرو در محل شما تحت پوشش کامل بیمه حوادث کار و مسئولیت مدنی معتبر قرار دارد.'
    },
    {
      icon: <CreditCard className="w-7 h-7 text-purple-600" />,
      title: 'تعرفه شفاف و پرداخت پس از اتمام کار',
      desc: 'هیچ هزینه پنهانی وجود ندارد. می‌توانید پس از اتمام کامل نظافت و بررسی کیفیت، وجه را نقدی یا آنلاین پرداخت نمایید.'
    },
    {
      icon: <Headphones className="w-7 h-7 text-amber-600" />,
      title: 'پشتیبانی فعال ۲۴ ساعته',
      desc: 'تیم پشتیبانی اختصاصی پاک‌شو در تمام مراحل از قبل از شروع تا پایان کار و نظرسنجی همراه شماست.'
    },
    {
      icon: <BadgeCheck className="w-7 h-7 text-rose-600" />,
      title: 'رعایت کامل پروتکل‌های بهداشتی',
      desc: 'استفاده از دستکش، دستمال‌های تفکیک‌شده نانو برای سرویس‌ها و آشپزخانه جهت جلوگیری از انتقال هرگونه آلودگی.'
    }
  ];

  return (
    <section id="why-us" className="py-16 sm:py-20 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
            <span>چرا بیش از ۲۵,۰۰۰ خانواده به ما اعتماد کرده‌اند؟</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            استانداردهای امنیت و ضمانت خدمات پاک‌شو
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            ما متعهدیم تا تجربه‌ای امن، آرامش‌بخش و با بالاترین سطح تمیزی را برای خانه و محیط کار شما به ارمغان آوریم.
          </p>
        </div>

        {/* Guarantees Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {guarantees.map((item, index) => (
            <div
              key={index}
              className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 hover:border-emerald-500/30 hover:bg-emerald-50/20 transition-all duration-300 space-y-3.5"
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200/60 flex items-center justify-center">
                {item.icon}
              </div>
              <h3 className="font-bold text-base text-slate-900">
                {item.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
