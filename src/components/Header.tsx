import React, { useState } from 'react';
import { 
  Sparkles, 
  PhoneCall, 
  Search, 
  CalendarCheck, 
  Menu, 
  X, 
  ShieldCheck, 
  Bot
} from 'lucide-react';
import { DISCOUNT_CODES } from '../data/mockData';

interface HeaderProps {
  onOpenBooking: (serviceId?: string) => void;
  onOpenTracker: () => void;
  onOpenAiConsultant: () => void;
  ordersCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBooking,
  onOpenTracker,
  onOpenAiConsultant,
  ordersCount
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const PROMO_CODE = 'PAK1403';
  const promoAmountFa = ((DISCOUNT_CODES[PROMO_CODE] ?? 100000) / 1000).toLocaleString('fa-IR');

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs md:text-sm py-1.5 px-4 font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center bg-emerald-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
              تخفیف ویژه
            </span>
            <span>
              با کد تخفیف{' '}
              <strong dir="ltr" className="bg-white/20 px-1.5 py-0.5 rounded font-mono text-amber-200 inline-block">{PROMO_CODE}</strong>
              {' '}{promoAmountFa} هزار تومان تخفیف بگیرید!
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-emerald-100">
            <span className="hidden md:flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              بیمه مسئولیت و احراز هویت نیروها
            </span>
            <span className="hidden lg:flex items-center gap-1">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-300" />
              ۰۲۱-۸۸۹۹۰۰۱۱
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-slate-800 flex items-center gap-1">
                  پاک‌<span className="text-emerald-600">شو</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  سامانه هوشمند خدمات نظافت
                </span>
              </div>
            </a>

            {/* Desktop Nav Items */}
            <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-700">
              <button 
                onClick={() => scrollToSection('services')}
                className="hover:text-emerald-600 transition-colors cursor-pointer"
              >
                خدمات تخصصی
              </button>
              <button 
                onClick={() => scrollToSection('calculator')}
                className="hover:text-emerald-600 transition-colors cursor-pointer"
              >
                محاسبه آنلاین قیمت
              </button>
              <button 
                onClick={() => scrollToSection('cleaners')}
                className="hover:text-emerald-600 transition-colors cursor-pointer"
              >
                متخصصین نظافت
              </button>
              <button 
                onClick={() => scrollToSection('why-us')}
                className="hover:text-emerald-600 transition-colors cursor-pointer"
              >
                ضمانت و بیمه
              </button>
              <button 
                onClick={() => scrollToSection('reviews')}
                className="hover:text-emerald-600 transition-colors cursor-pointer"
              >
                نظرات مشتریان
              </button>
              <button 
                onClick={() => scrollToSection('faq')}
                className="hover:text-emerald-600 transition-colors cursor-pointer"
              >
                سوالات متداول
              </button>
              <button 
                onClick={() => scrollToSection('tips')}
                className="hover:text-emerald-600 transition-colors cursor-pointer"
              >
                مجله نظافت
              </button>
            </nav>
          </div>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* AI Advisor Button */}
            <button
              onClick={onOpenAiConsultant}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl transition-all shadow-xs cursor-pointer"
              title="مشاور هوشمند تخمین زمان و نوع نظافت"
            >
              <Bot className="w-4 h-4 text-teal-600 animate-bounce" />
              <span>مشاور هوشمند</span>
            </button>

            {/* Order Tracking Button */}
            <button
              onClick={onOpenTracker}
              className="relative flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              <Search className="w-4 h-4 text-slate-500" />
              <span>پیگیری سفارش</span>
              {ordersCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 text-[11px] font-bold text-white bg-emerald-600 rounded-full">
                  {ordersCount}
                </span>
              )}
            </button>

            {/* Instant Booking CTA Button */}
            <button
              onClick={() => onOpenBooking()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all cursor-pointer active:scale-98"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>رزرو آنلاین نظافت</span>
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={onOpenTracker}
              className="p-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              aria-label="پیگیری سفارش"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 rounded-lg hover:bg-slate-100 focus:outline-hidden"
              aria-label="باز کردن منو"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-2 pb-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenBooking();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-3 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-md"
            >
              <CalendarCheck className="w-4 h-4" />
              رزرو فوری نظافت
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAiConsultant();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-3 bg-teal-50 text-teal-800 border border-teal-200 font-bold rounded-xl text-sm"
            >
              <Bot className="w-4 h-4 text-teal-600" />
              مشاور هوشمند
            </button>
          </div>

          <div className="flex flex-col space-y-1 font-medium text-slate-700 text-sm">
            <button
              onClick={() => scrollToSection('services')}
              className="text-right py-2.5 px-3 rounded-lg hover:bg-slate-100"
            >
              خدمات تخصصی نظافت
            </button>
            <button
              onClick={() => scrollToSection('calculator')}
              className="text-right py-2.5 px-3 rounded-lg hover:bg-slate-100"
            >
              محاسبه آنلاین قیمت
            </button>
            <button
              onClick={() => scrollToSection('cleaners')}
              className="text-right py-2.5 px-3 rounded-lg hover:bg-slate-100"
            >
              متخصصین نظافت برتر
            </button>
            <button
              onClick={() => scrollToSection('why-us')}
              className="text-right py-2.5 px-3 rounded-lg hover:bg-slate-100"
            >
              ضمانت و پوشش بیمه
            </button>
            <button
              onClick={() => scrollToSection('reviews')}
              className="text-right py-2.5 px-3 rounded-lg hover:bg-slate-100"
            >
              نظرات مشتریان
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="text-right py-2.5 px-3 rounded-lg hover:bg-slate-100"
            >
              سوالات متداول
            </button>
            <button
              onClick={() => scrollToSection('tips')}
              className="text-right py-2.5 px-3 rounded-lg hover:bg-slate-100"
            >
              مجله و ترفندهای نظافت
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1 text-slate-700 font-bold">
              <PhoneCall className="w-4 h-4 text-emerald-600" />
              تماس فوری: ۰۲۱-۸۸۹۹۰۰۱۱
            </span>
            <span>پشتیبانی شبانه‌روزی</span>
          </div>
        </div>
      )}
    </header>
  );
};
