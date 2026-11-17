import { describe, expect, it } from 'vitest';
import {
  buildPakshoOperationalFields,
  durationHoursForPakshoOrder,
  formatPakshoOrderAddress,
  mapPakshoGenderPreference,
  pakshoAreaFromAddress,
} from './pakshoOrderPayload';

describe('mapPakshoGenderPreference', () => {
  it('maps site values to backend enums', () => {
    expect(mapPakshoGenderPreference('female')).toBe('FEMALE');
    expect(mapPakshoGenderPreference('male')).toBe('MALE');
    expect(mapPakshoGenderPreference('no-pref')).toBe('NO_PREFERENCE');
  });

  it('omits gender when the site has no selection', () => {
    expect(mapPakshoGenderPreference(undefined)).toBeUndefined();
    expect(mapPakshoGenderPreference('')).toBeUndefined();
  });
});

describe('durationHoursForPakshoOrder', () => {
  it('sends selected hours only for hourly pricing', () => {
    expect(durationHoursForPakshoOrder('hourly', 4, false)).toBe(4);
    expect(durationHoursForPakshoOrder('hourly', 6, false)).toBe(6);
  });

  it('does not treat quantity as duration for sofa, fixed, count, or area models', () => {
    expect(durationHoursForPakshoOrder('hourly', 4, true)).toBeUndefined();
    expect(durationHoursForPakshoOrder('fixed', 1, false)).toBeUndefined();
    expect(durationHoursForPakshoOrder('count', 2, false)).toBeUndefined();
    expect(durationHoursForPakshoOrder('area', 90, false)).toBeUndefined();
  });
});

describe('formatPakshoOrderAddress', () => {
  it('puts the neighbourhood first so the specialist preview area is not the city', () => {
    const address = formatPakshoOrderAddress({
      district: 'سعادت‌آباد و شهرک غرب',
      cityName: 'تهران',
      street: 'خیابان سرو غربی، کوچه ۵، پلاک ۱۲',
      unit: '۳',
    });
    expect(address.startsWith('سعادت‌آباد و شهرک غرب،')).toBe(true);
    expect(pakshoAreaFromAddress(address)).toBe('سعادت‌آباد و شهرک غرب');
    expect(address).toContain('تهران');
    expect(address).toContain('خیابان سرو غربی، کوچه ۵، پلاک ۱۲');
    expect(address.endsWith('واحد ۳')).toBe(true);
  });

  it('keeps the full street out of the pre-accept area when the first segment has digits', () => {
    expect(pakshoAreaFromAddress('خیابان آزادی پلاک ۲۰')).toBe('');
  });
});

describe('buildPakshoOperationalFields — hourly vs sofa', () => {
  it('sends the selected hourly service title, hours, gender, and neighbourhood-first address', () => {
    const fields = buildPakshoOperationalFields({
      serviceTitle: 'نظافت عمیق و تخصصی (خانه‌تکانی)',
      pricingModel: 'hourly',
      isSofa: false,
      hours: 6,
      gender: 'female',
      quoteOptions: { detergent: true },
      address: {
        district: 'ونک و ملاصدرا',
        cityName: 'تهران',
        street: 'خیابان ملاصدرا، پلاک ۱۰',
        unit: '۲',
      },
    });
    expect(fields.serviceTitle).toBe('نظافت عمیق و تخصصی (خانه‌تکانی)');
    expect(fields.durationHours).toBe(6);
    expect(fields.genderPreference).toBe('FEMALE');
    expect(fields.serviceOptions).toEqual({ detergent: true });
    expect(pakshoAreaFromAddress(fields.address)).toBe('ونک و ملاصدرا');
    expect(fields.address).toContain('خیابان ملاصدرا، پلاک ۱۰');
  });

  it('keeps sofa quantity out of durationHours and copies selected sofa options', () => {
    const fields = buildPakshoOperationalFields({
      serviceTitle: 'مبل‌شویی و فرش‌شویی در محل',
      pricingModel: 'count',
      isSofa: true,
      hours: 3,
      gender: 'no-pref',
      quoteOptions: { seatSize: '9' },
      sofa: { mattresses: 2, seatSize: '9' },
      address: {
        district: 'پونک',
        cityName: 'تهران',
        street: 'بلوار همیلا، پلاک ۱۸',
        unit: '',
      },
    });
    expect(fields.serviceTitle).toBe('مبل‌شویی و فرش‌شویی در محل');
    expect(fields.durationHours).toBeUndefined();
    expect(fields.genderPreference).toBe('NO_PREFERENCE');
    expect(fields.serviceOptions).toEqual({
      seatSize: '9',
      mattresses: 2,
      sofaSeats: '۹ نفره',
    });
    expect(pakshoAreaFromAddress(fields.address)).toBe('پونک');
  });
});
