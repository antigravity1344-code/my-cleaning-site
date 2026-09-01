import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  X, 
  Send, 
  CheckCircle2, 
  ArrowLeft, 
  Clock, 
  Layers, 
  Lightbulb 
} from 'lucide-react';
import { ServiceType, CleanerGender } from '../types';
import { SERVICES_LIST } from '../data/mockData';

interface AiConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyRecommendation: (recommendation: {
    serviceId: ServiceType;
    hours: number;
    cleanerGender: CleanerGender;
    selectedAddons: string[];
    hasDetergentPackage: boolean;
  }) => void;
}

export const AiConsultantModal: React.FC<AiConsultantModalProps> = ({
  isOpen,
  onClose,
  onApplyRecommendation
}) => {
  const [userInput, setUserInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    serviceId: ServiceType;
    serviceTitle: string;
    recommendedHours: number;
    cleanersCount: number;
    recommendedAddons: string[];
    hasDetergent: boolean;
    analysisText: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim()) return;

    setIsAnalyzing(true);
    setResult(null);

    // Smart heuristic analysis
    setTimeout(() => {
      const text = userInput.toLowerCase();
      let sId: ServiceType = 'home-standard';
      let h = 4;
      let cleaners = 1;
      let addons: string[] = [];
      let detergent = true;

      if (text.includes('نقاشی') || text.includes('بازسازی') || text.includes('بنایی') || text.includes('گچ') || text.includes('نوساز')) {
        sId = 'post-construction';
        h = 7;
        addons.push('windows', 'walls');
      } else if (text.includes('مبل') || text.includes('فرش') || text.includes('تشک') || text.includes('موکت')) {
        sId = 'furniture-carpet';
        h = 4;
      } else if (text.includes('خانه‌تکانی') || text.includes('عمیق') || text.includes('اساسی') || text.includes('دیوار') || text.includes('کابینت')) {
        sId = 'home-deep';
        h = 6;
        addons.push('appliances', 'walls');
      } else if (text.includes('شرکت') || text.includes('دفتر') || text.includes('اداره') || text.includes('میز')) {
        sId = 'office';
        h = 5;
      } else if (text.includes('راه‌پله') || text.includes('مشاعات') || text.includes('پارکینگ') || text.includes('آسانسور')) {
        sId = 'building-staircase';
        h = 4;
      }

      // Check numbers in text for meters
      const meterMatch = text.match(/(\d+)\s*(متر|متری)/);
      if (meterMatch) {
        const meters = parseInt(meterMatch[1], 10);
        if (meters > 180) {
          cleaners = 2;
          h = Math.max(h, 6);
        } else if (meters > 120) {
          h = Math.max(h, 5);
        }
      }

      const sObj = SERVICES_LIST.find(s => s.id === sId) || SERVICES_LIST[0];

      setResult({
        serviceId: sId,
        serviceTitle: sObj.title,
        recommendedHours: h,
        cleanersCount: cleaners,
        recommendedAddons: addons,
        hasDetergent: detergent,
        analysisText: `بر اساس نیازهای مطرح شده شما، مناسب‌ترین خدمت «${sObj.title}» به مدت تقریبی ${h} ساعت با حضور ${cleaners} نیروی متخصص می‌باشد تا کلیه فضاها با بالاترین کیفیت تمیز و ضدعفونی شوند.`
      });

      setIsAnalyzing(false);
    }, 900);
  };

  const presetExamples = [
    'یک واحد ۱۲۰ متری دوخوابه که ۶ ماهه نظافت اساسی نشده و دیوارها و فر هم کثیفند',
    'آپارتمان ۸۵ متری نوساز که تازه نقاشی شده و روی شیشه‌ها و سرامیک لکه‌های گچ و رنگ داره',
    'یک ست مبل ۸ نفره پارچه‌ای با لکه‌های چای به همراه نظافت هفتگی سالن'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:px-8 border-b border-slate-200/80 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                مشاور هوشمند تخمین زمان و خدمت پاک‌شو
              </h3>
              <p className="text-xs text-slate-400">
                شرح منزل یا نیاز خود را بنویسید تا زمان و هزینه دقیق پیشنهاد شود
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-8 overflow-y-auto space-y-5 text-slate-800">
          
          {/* Preset Prompts */}
          <div>
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              نمونه‌های پیشنهادی برای آزمایش سریع:
            </span>
            <div className="space-y-1.5">
              {presetExamples.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setUserInput(ex);
                  }}
                  className="w-full text-right p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 text-xs text-slate-700 transition-colors cursor-pointer block"
                >
                  «{ex}»
                </button>
              ))}
            </div>
          </div>

          {/* User Input Area */}
          <form onSubmit={handleAnalyze} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              توضیحات فضا و نیازهای نظافتی شما:
            </label>
            <div className="relative">
              <textarea
                rows={3}
                placeholder="مثلا: خانه ۱۰۰ متری در غرب تهران، نظافت هفتگی و شستن حمام و سینک ظرفشویی..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 leading-relaxed"
              />
              <button
                type="submit"
                disabled={isAnalyzing || !userInput.trim()}
                className="absolute left-3 bottom-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>در حال تحلیل...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>تحلیل و برآورد</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Result Card */}
          {result && (
            <div className="p-5 rounded-3xl bg-emerald-50/80 border border-emerald-200 space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>نتیجه برآورد هوشمند پاک‌شو:</span>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {result.analysisText}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-white p-3 rounded-2xl border border-emerald-100 text-center">
                  <span className="text-[11px] text-slate-500 block">خدمت پیشنهادی:</span>
                  <strong className="text-xs font-bold text-slate-900 block mt-0.5">{result.serviceTitle}</strong>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-emerald-100 text-center">
                  <span className="text-[11px] text-slate-500 block">مدت زمان بهینه:</span>
                  <strong className="text-xs font-bold text-emerald-700 font-mono block mt-0.5">{result.recommendedHours} ساعت</strong>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-emerald-100 text-center col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-slate-500 block">تعداد نیروی لازم:</span>
                  <strong className="text-xs font-bold text-slate-900 block mt-0.5">{result.cleanersCount} نفر متخصص</strong>
                </div>
              </div>

              <button
                onClick={() => {
                  onApplyRecommendation({
                    serviceId: result.serviceId,
                    hours: result.recommendedHours,
                    cleanerGender: 'no-pref',
                    selectedAddons: result.recommendedAddons,
                    hasDetergentPackage: result.hasDetergent
                  });
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md shadow-emerald-600/30 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <span>انتقال مستقیم این مشخصات به فرم رزرو</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
