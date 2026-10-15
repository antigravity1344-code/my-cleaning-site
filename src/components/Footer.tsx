import React from 'react';
import { 
  Sparkles, 
  PhoneCall, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Clock, 
  Award,
  ChevronLeft
} from 'lucide-react';
import { VERIFIED_TRUST_CLAIMS_AVAILABLE } from '../config/capabilities';

interface FooterProps {
  onOpenBooking: () => void;
  onOpenTracker: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenBooking,
  onOpenTracker
}) => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Feature Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12 border-b border-slate-800">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">نسخه آزمایشی — بدون ضمانت قابل اجرا</h4>
              <p className="text-xs text-slate-400 mt-0.5">شرایط جبران خدمت پس از تأیید سیاست رسمی اعلام خواهد شد</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">{VERIFIED_TRUST_CLAIMS_AVAILABLE ? 'متخصصین گزینش شده' : 'فهرست متخصصین نمونه'}</h4>
              {VERIFIED_TRUST_CLAIMS_AVAILABLE ? <p className="text-xs text-slate-400 mt-0.5">احراز هویت کامل، عدم سوءپیشینه و آزمایش سلامت</p> : <p className="text-xs text-slate-400 mt-0.5">این نسخه آزمایشی است و به سرور عملیات متصل نیست</p>}
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">ساعات پشتیبانی</h4>
              <p className="text-xs text-slate-400 mt-0.5">ساعات پاسخگویی پس از راه‌اندازی رسمی سرویس پشتیبانی اعلام می‌شود</p>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 py-12">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black text-white">
                پاک‌<span className="text-emerald-500">شو</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              نسخه آزمایشی سامانه آنلاین خدمات نظافت منزل، محل کار، راه‌پله و مبل‌شویی. قیمت‌های نمایش‌داده‌شده پیشنهادی و آزمایشی هستند.
            </p>
            <div className="pt-2 text-xs text-slate-400 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تلفن تماس: ۰۲۱-۸۸۹۹۰۰۱۱</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ایمیل پشتیبانی: info@paksho.ir</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تهران، خیابان ولیعصر، تقاطع فاطمی، پلاک ۱۲</span>
              </div>
            </div>
          </div>

          {/* Quick Access */}
          <div>
            <h4 className="font-bold text-white text-sm mb-4">دسترسی سریع</h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <button onClick={() => scrollTo('services')} className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  خدمات نظافت منزل و محل کار
                </button>
              </li>
              <li>
                <button onClick={() => scrollTo('calculator')} className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  محاسبه‌گر آنلاین هزینه
                </button>
              </li>
              <li>
                <button onClick={() => scrollTo('cleaners')} className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  لیست متخصصین منتخب
                </button>
              </li>
              <li>
                <button onClick={() => scrollTo('why-us')} className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  ضمانت و پوشش (در انتظار تأیید)
                </button>
              </li>
              <li>
                <button onClick={onOpenTracker} className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 text-emerald-400 font-semibold">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  پیگیری وضعیت سفارش
                </button>
              </li>
            </ul>
          </div>

          {/* Popular Services */}
          <div>
            <h4 className="font-bold text-white text-sm mb-4">محبوب‌ترین خدمات</h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <button onClick={onOpenBooking} className="hover:text-emerald-400 transition-colors cursor-pointer">
                  نظافت کامل و استاندارد منزل
                </button>
              </li>
              <li>
                <button onClick={onOpenBooking} className="hover:text-emerald-400 transition-colors cursor-pointer">
                  شستشوی مبلمان و تشک با دستگاه
                </button>
              </li>
              <li>
                <button onClick={onOpenBooking} className="hover:text-emerald-400 transition-colors cursor-pointer">
                  نظافت مشاعات، راه‌پله و پارکینگ
                </button>
              </li>
              <li>
                <button onClick={onOpenBooking} className="hover:text-emerald-400 transition-colors cursor-pointer">
                  نظافت اداری و دفاتر کار
                </button>
              </li>
              <li>
                <button onClick={onOpenBooking} className="hover:text-emerald-400 transition-colors cursor-pointer">
                  پکیج ویژه خانه‌تکانی عید و عیدانه
                </button>
              </li>
            </ul>
          </div>

          {/* Trust badges */}
          <div>
            <h4 className="font-bold text-white text-sm mb-4">مجوزها و تاییده‌ها</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-800 rounded-xl text-center border border-slate-700 flex flex-col items-center justify-center">
                <span className="text-[11px] font-bold text-slate-300">نماد اعتماد الکترونیکی</span>
                <span className="text-[10px] text-amber-400 mt-1">در انتظار صدور/درج کد رهگیری</span>
              </div>
              <div className="p-3 bg-slate-800 rounded-xl text-center border border-slate-700 flex flex-col items-center justify-center">
                <span className="text-[11px] font-bold text-slate-300">اتحادیه قالیشویان</span>
                <span className="text-[10px] text-amber-400 mt-1">در انتظار ارائه مستند عضویت</span>
              </div>
              <div className="p-3 bg-slate-800 rounded-xl text-center border border-slate-700 flex flex-col items-center justify-center col-span-2">
                <span className="text-[11px] font-bold text-slate-300">بیمه مسئولیت مدنی</span>
                <span className="text-[10px] text-amber-400 mt-1">در انتظار درج شماره بیمه‌نامه معتبر</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© تمامی حقوق مادی و معنوی این سامانه متعلق به شرکت «پاک‌شو» می‌باشد. نسخه فعلی، نسخه آزمایشی و غیرعملیاتی است.</p>
          <p>طراحی شده با React 19، TypeScript و Tailwind CSS</p>
        </div>

      </div>
    </footer>
  );
};
