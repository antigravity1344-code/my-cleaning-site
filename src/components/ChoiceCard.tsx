import React from 'react';

interface ChoiceCardProps {
  /** `radio` برای «یکی از چند گزینه»، `checkbox` برای گزینه‌ای که روشن/خاموش می‌شود. */
  type: 'radio' | 'checkbox';
  /** برای radio: نام مشترک همه‌ی گزینه‌های یک گروه. */
  name?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** کلاس‌های ظاهری کارت (حاشیه، رنگ، چیدمان). */
  className?: string;
  /** محتوای کارت؛ فقط عناصر درون‌خطی مثل span (محتوای مجاز داخل label). */
  children: React.ReactNode;
}

/**
 * کارت انتخاب قابل‌دسترس.
 *
 * پیش از این، گزینه‌های فرم رزرو `div` کلیک‌پذیر بودند: با صفحه‌کلید انتخاب نمی‌شدند و
 * صفحه‌خوان نه نقش آن‌ها را می‌فهمید و نه انتخاب‌شدنشان را. این کارت یک input
 * واقعی (radio یا checkbox) دارد که از دید پنهان است ولی برای صفحه‌کلید و صفحه‌خوان
 * وجود دارد؛ همه‌ی کارت، برچسب (label) همان input است. بنابراین:
 *   • کلیک روی هر جای کارت مثل قبل کار می‌کند،
 *   • Tab به گروه می‌رود، Space انتخاب می‌کند و در گروه radio کلیدهای جهت بین گزینه‌ها
 *     جابه‌جا می‌شوند (رفتار بومی مرورگر)،
 *   • صفحه‌خوان «انتخاب‌شده / انتخاب‌نشده» را اعلام می‌کند،
 *   • وقتی input با صفحه‌کلید فوکوس دارد، دور کارت حاشیه‌ی فوکوس دیده می‌شود.
 */
export function ChoiceCard({
  type,
  name,
  checked,
  onChange,
  disabled = false,
  className = '',
  children,
}: ChoiceCardProps) {
  return (
    <label
      className={`relative ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-600 ${className}`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      {children}
    </label>
  );
}
