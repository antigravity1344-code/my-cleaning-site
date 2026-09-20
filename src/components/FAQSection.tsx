import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  Search, 
  PhoneCall
} from 'lucide-react';
import { FAQ_LIST } from '../data/mockData';

export const FAQSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'safety' | 'pricing' | 'booking' | 'services'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-1');

  const filteredFaqs = FAQ_LIST.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.question.includes(searchQuery) || item.answer.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const toggleFaq = (id: string) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  return (
    <section id="faq" className="py-16 sm:py-20 bg-white relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>پاسخ به سوالات پرتکرار شما</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            پرسش‌های متداول درباره خدمات نظافت
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            پاسخ سریع به متداول‌ترین سوالات درباره احراز هویت، نحوه قیمت‌گذاری، بیمه و گارانتی پاک‌شو.
          </p>
        </div>

        {/* Search Bar & Categories */}
        <div className="space-y-4 mb-8">
          
          {/* Search Box */}
          <div className="relative max-w-xl mx-auto">
            <input
              type="text"
              placeholder="جستجو در بین سوالات متداول (مثلا: لغو سفارش، شوینده، بیمه)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pr-11 pl-4 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-xs"
            />
            <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { id: 'all', label: 'همه سوالات' },
              { id: 'safety', label: 'امنیت و احراز هویت' },
              { id: 'pricing', label: 'قیمت‌گذاری و پرداخت' },
              { id: 'booking', label: 'رزرو و کنسلی' },
              { id: 'services', label: 'وسایل و خدمات' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen 
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-xs' 
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full p-4 sm:p-5 text-right flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="font-bold text-sm sm:text-base text-slate-900">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-emerald-600' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-emerald-100/60 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              موردی با جستجوی شما یافت نشد. می‌توانید مستقیماً با پشتیبانی تماس بگیرید.
            </div>
          )}
        </div>

        {/* Still Have Questions Box */}
        <div className="mt-12 p-6 sm:p-8 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1 text-center sm:text-right">
            <h4 className="text-base sm:text-lg font-black">
              پاسخ سوال خود را پیدا نکردید؟
            </h4>
            <p className="text-xs text-slate-400">
              تیم پشتیبانی ۲۴ ساعته پاک‌شو مشتاقانه آماده پاسخگویی و مشاوره رایگان به شماست.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="tel:02188990011"
              className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-md transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              <span>تماس مستقیم: ۰۲۱-۸۸۹۹۰۰۱۱</span>
            </a>
          </div>
        </div>

      </div>
    </section>
  );
};
