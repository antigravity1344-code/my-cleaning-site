import { describe, expect, it } from 'vitest';
import { sofaQuoteInput } from './sofaQuote';

describe('sofaQuoteInput', () => {
  it('mattress_seat mode sends count and seat size', () => {
    expect(sofaQuoteInput('mattress_seat', { mattresses: 2, seatSize: '9' })).toEqual({ quantity: 2, options: { seatSize: '9' } });
    expect(sofaQuoteInput('mattress_seat', { mattresses: 1, seatSize: '7' })).toEqual({ quantity: 1, options: { seatSize: '7' } });
  });

  it('units mode sends count without seat size', () => {
    expect(sofaQuoteInput('units', { mattresses: 3, seatSize: '7' })).toEqual({ quantity: 3, options: {} });
  });

  it('returns null when the service has no pricing mode', () => {
    expect(sofaQuoteInput(null, { mattresses: 1, seatSize: '7' })).toBeNull();
    expect(sofaQuoteInput(undefined, { mattresses: 1, seatSize: '7' })).toBeNull();
  });

  it('rejects counts outside 1..20 and non-integers', () => {
    expect(sofaQuoteInput('units', { mattresses: 0, seatSize: '7' })).toBeNull();
    expect(sofaQuoteInput('units', { mattresses: 21, seatSize: '7' })).toBeNull();
    expect(sofaQuoteInput('units', { mattresses: 1.5, seatSize: '7' })).toBeNull();
    expect(sofaQuoteInput('units', { mattresses: Number.NaN, seatSize: '7' })).toBeNull();
  });
});
