import React from 'react';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import { DEMO_COPY, DEMO_MODE } from '../config/capabilities';

/**
 * نشان‌گذاری صریح حالت آزمایشی.
 * هر بخشی از سایت که ممکن است کاربر آن را «عملیاتی» تصور کند باید این نشان را داشته باشد.
 */

export const DemoBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold ${className}`}
  >
    <FlaskConical className="w-3 h-3" />
    {DEMO_COPY.badge}
  </span>
);

export const DemoSampleBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center rounded-full bg-slate-200 text-slate-700 border border-slate-300 px-2 py-0.5 text-[10px] font-bold ${className}`}
  >
    {DEMO_COPY.sampleDataBadge}
  </span>
);

/** نوار هشدار سراسری بالای سایت. */
export const DemoModeBanner: React.FC = () => {
  if (!DEMO_MODE) return null;
  return (
    <div
      role="status"
      className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs sm:text-sm py-2 px-4"
    >
      <div className="max-w-7xl mx-auto flex items-start sm:items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
        <p className="leading-relaxed">{DEMO_COPY.banner}</p>
      </div>
    </div>
  );
};

/** توضیح درون‌فرمی درباره آزمایشی‌بودن جریان. */
export const DemoInlineNotice: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <div
    className={`p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] sm:text-xs leading-relaxed ${className}`}
  >
    {text}
  </div>
);

/** یادداشت «مبلغ پیشنهادی» برای همه‌جا که عددی به‌عنوان قیمت نمایش داده می‌شود. */
export const ProvisionalPriceNote: React.FC<{ className?: string }> = ({ className = '' }) => (
  <p className={`text-[10px] sm:text-[11px] text-slate-500 leading-relaxed ${className}`}>
    {DEMO_COPY.provisionalPriceNote}
  </p>
);
