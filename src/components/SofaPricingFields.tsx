import { SOFA_DISABLED_TEXT, type SofaDetails, sofaPricingFields } from '../services/usePakshoQuote';
import { toLatinDigits } from '../services/pii';

interface Props {
  rule: ReturnType<typeof sofaPricingFields>;
  details: SofaDetails;
  onChange: (details: SofaDetails) => void;
}

export function SofaPricingFields({ rule, details, onChange }: Props) {
  if (!rule.mode) return <p role="status" className="text-xs text-slate-700">{SOFA_DISABLED_TEXT}</p>;
  const fieldClass = 'block w-full mt-1 rounded-xl border border-slate-200 bg-white p-2';
  return (
    <div className="space-y-3 text-right text-xs font-bold text-slate-700">
      {rule.mode === 'mattress_seat' && (
        <label className="block">
          نوع نشیمن
          <select className={fieldClass} value={details.seatSize}
            onChange={event => onChange({ ...details, seatSize: event.target.value })}>
            <option value="">انتخاب کنید</option>
            {rule.seatSizes.map(size => <option key={size} value={size}>{Number(size).toLocaleString('fa-IR')} نفره</option>)}
          </select>
        </label>
      )}
      <label className="block">
        {rule.mode === 'units' ? 'تعداد واحد' : 'تعداد تشک'}
        <input className={fieldClass} inputMode="numeric" value={details.quantity}
          onChange={event => onChange({ ...details, quantity: toLatinDigits(event.target.value) })} />
      </label>
    </div>
  );
}
