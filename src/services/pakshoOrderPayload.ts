import type { CleanerGender } from '../types';
import type { PricingRule } from './pakshoApi';
import type { SofaFormValues, SofaSeat } from './sofaQuote';

export type PakshoGenderPreference = 'FEMALE' | 'MALE' | 'NO_PREFERENCE';
export type PakshoServiceOptionValue = string | number | boolean;

const GENDER_MAP: Record<CleanerGender, PakshoGenderPreference> = {
  female: 'FEMALE',
  male: 'MALE',
  'no-pref': 'NO_PREFERENCE',
};

const SOFA_SEAT_LABELS: Record<SofaSeat, string> = {
  '7': '۷ نفره',
  '9': '۹ نفره',
};

export interface PakshoOrderAddressParts {
  district: string;
  cityName: string;
  street: string;
  unit: string;
}

export interface PakshoOperationalOrderFields {
  serviceTitle: string;
  durationHours?: number;
  genderPreference?: PakshoGenderPreference;
  serviceOptions?: Record<string, PakshoServiceOptionValue>;
  address: string;
}

/**
 * اولین بخش آدرس (قبل از «،») همان محدوده‌ای است که بک‌اند برای نمای پیش از پذیرش متخصص
 * استخراج می‌کند. بخش دارای رقم یا بلندتر از ۴۰ نویسه فرستاده نمی‌شود.
 */
export function pakshoAreaFromAddress(address: string): string {
  const first = String(address || '').split(/[،,]/)[0].trim();
  if (!first || first.length > 40 || /[0-9۰-۹٠-٩]/.test(first)) return '';
  return first;
}

export function mapPakshoGenderPreference(
  gender: CleanerGender | '' | null | undefined,
): PakshoGenderPreference | undefined {
  if (!gender) return undefined;
  return GENDER_MAP[gender];
}

export function durationHoursForPakshoOrder(
  model: PricingRule['model'] | undefined,
  hours: number,
  isSofa: boolean,
): number | undefined {
  if (isSofa || model !== 'hourly') return undefined;
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) return undefined;
  return hours;
}

export function formatPakshoOrderAddress(parts: PakshoOrderAddressParts): string {
  const district = parts.district.trim();
  const cityName = parts.cityName.trim();
  const street = parts.street.trim();
  const unitRaw = parts.unit.trim();
  const unit = unitRaw ? (unitRaw.startsWith('واحد') ? unitRaw : `واحد ${unitRaw}`) : '';
  return [district, cityName, street, unit].filter(Boolean).join('، ');
}

export function operationalServiceOptions(input: {
  quoteOptions?: Record<string, unknown>;
  sofa?: SofaFormValues;
  isSofa: boolean;
}): Record<string, PakshoServiceOptionValue> | undefined {
  const options: Record<string, PakshoServiceOptionValue> = {};
  for (const [key, raw] of Object.entries(input.quoteOptions ?? {})) {
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      options[key] = raw;
    }
  }
  if (input.isSofa && input.sofa) {
    options.mattresses = input.sofa.mattresses;
    if (input.sofa.seatSize === '7' || input.sofa.seatSize === '9') {
      options.sofaSeats = SOFA_SEAT_LABELS[input.sofa.seatSize];
    }
  }
  return Object.keys(options).length ? options : undefined;
}

export function buildPakshoOperationalFields(input: {
  serviceTitle: string;
  pricingModel?: PricingRule['model'];
  isSofa: boolean;
  hours: number;
  gender: CleanerGender | '' | null | undefined;
  quoteOptions?: Record<string, unknown>;
  sofa?: SofaFormValues;
  address: PakshoOrderAddressParts;
}): PakshoOperationalOrderFields {
  const durationHours = durationHoursForPakshoOrder(input.pricingModel, input.hours, input.isSofa);
  const genderPreference = mapPakshoGenderPreference(input.gender);
  const serviceOptions = operationalServiceOptions({
    quoteOptions: input.quoteOptions,
    sofa: input.sofa,
    isSofa: input.isSofa,
  });
  return {
    serviceTitle: input.serviceTitle.trim().slice(0, 120),
    ...(durationHours !== undefined ? { durationHours } : {}),
    ...(genderPreference ? { genderPreference } : {}),
    ...(serviceOptions ? { serviceOptions } : {}),
    address: formatPakshoOrderAddress(input.address),
  };
}
