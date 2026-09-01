import React, { useState } from 'react';
import { 
  BookOpen, 
  Clock, 
  Sparkles, 
  ArrowLeft, 
  Share2, 
  Check 
} from 'lucide-react';
import { CLEANING_TIPS } from '../data/mockData';
import { CleaningTip } from '../types';

export const CleaningTipsSection: React.FC = () => {
  const [selectedTip, setSelectedTip] = useState<CleaningTip | null>(null);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="tips" className="py-16 sm:py-20 bg-slate-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            <span>مجله تخصصی و ترفندهای نظافت</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            نکات و ترفندهای کاربردی خانه‌داری
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            جدیدترین فرمول‌ها و روش‌های آسان برای درخشش خانه، پاک کردن لکه‌های سرسخت و افزایش عمر وسایل.
          </p>
        </div>

        {/* Tips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {CLEANING_TIPS.map((tip) => (
            <div
              key={tip.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 hover:border-emerald-500/40 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={tip.image}
                    alt={tip.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs text-slate-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                    {tip.category}
                  </span>
                </div>

                <div className="p-6 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>زمان مطالعه: {tip.readTime}</span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors">
                    {tip.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {tip.summary}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-0">
                <button
                  onClick={() => setSelectedTip(tip)}
                  className="w-full py-2.5 px-4 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 hover:border-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>مطالعه دستورالعمل کامل</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>

      {/* Tip Reader Modal */}
      {selectedTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            
            <div className="relative h-48 shrink-0 overflow-hidden">
              <img
                src={selectedTip.image}
                alt={selectedTip.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <button
                onClick={() => setSelectedTip(null)}
                className="absolute top-4 left-4 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
              <div className="absolute bottom-4 right-4 text-white">
                <span className="text-xs bg-emerald-500 text-slate-950 font-bold px-2 py-0.5 rounded-full mb-1 inline-block">
                  {selectedTip.category}
                </span>
                <h3 className="text-lg font-black">{selectedTip.title}</h3>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700 leading-relaxed">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-950 text-xs font-medium">
                {selectedTip.summary}
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  مراحل و دستورالعمل اجرایی:
                </h4>
                <p className="text-slate-600 text-xs sm:text-sm leading-loose">
                  {selectedTip.content}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-emerald-700 font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'لینک کپی شد' : 'اشتراک‌گذاری'}</span>
              </button>

              <button
                onClick={() => setSelectedTip(null)}
                className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs"
              >
                متوجه شدم
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
