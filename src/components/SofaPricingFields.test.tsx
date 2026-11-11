// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each([
  { mode: 'mattress_seat', label: 'تعداد تشک', seatSizes: ['7', '9'], options: { seatSize: '9' }, total: 910000 },
  { mode: 'units', label: 'تعداد واحد', seatSizes: null, options: {}, total: 700000 },
  { mode: null, label: null, seatSizes: null, options: null, total: null },
])('renders the sofa booking fields and sends valid input for $mode', async ({ mode, label, seatSizes, options, total }) => {
  vi.stubEnv('VITE_PAKSHO_API_BASE', 'https://paksho.example');
  vi.resetModules();
  const quotes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/services/enabled')) return new Response(JSON.stringify({ pricingRules: [
      { serviceId: 'sofa_carpet_washing', model: 'count', pricingMode: mode, seatSizes },
    ] }));
    if (url.endsWith('/api/site/features')) return new Response('{}');
    if (url.endsWith('/api/pricing/quote')) {
      quotes.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ quote: { total, quoteToken: 'signed', surcharges: [], discounts: [] } }));
    }
    throw new Error(url);
  }));
  const { BookingModal } = await import('./BookingModal');
  render(<BookingModal isOpen initialServiceId="furniture-carpet" onClose={() => {}} onOrderCreated={() => {}} />);
  if (!label) {
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/api/services/enabled'))).toBe(true));
    expect(screen.getByText('این خدمت در این مجموعه فعال نیست')).toBeTruthy();
    expect(screen.queryByLabelText('تعداد تشک')).toBeNull();
    expect(screen.queryByLabelText('تعداد واحد')).toBeNull();
    expect((screen.getByRole('button', { name: 'مرحله بعد' }) as HTMLButtonElement).disabled).toBe(true);
    expect(quotes).toEqual([]);
    return;
  }
  const quantity = await screen.findByLabelText(label);
  fireEvent.change(quantity, { target: { value: '۲' } });
  if (mode === 'mattress_seat') {
    const seat = screen.getByLabelText('نوع نشیمن');
    expect((screen.getByRole('button', { name: 'مرحله بعد' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(seat, { target: { value: '9' } });
  } else {
    expect(screen.queryByLabelText('نوع نشیمن')).toBeNull();
  }
  expect(quotes).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'مرحله بعد' }));
  await waitFor(() => expect(quotes).toEqual([{ serviceId: 'sofa_carpet_washing', quantity: 2, options }]));
});
