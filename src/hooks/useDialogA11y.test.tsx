// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useDialogA11y } from './useDialogA11y';

/**
 * مسیر پشتیبان بازگشت فوکوس در useDialogA11y.
 *
 * در App، بخش inert‌شونده پیش از پنجره‌ها رندر می‌شود؛ پس هنگام بستن، inert پیش از
 * cleanup هوک برداشته می‌شود و بازگشت فوکوس همان لحظه موفق است. اینجا ترتیب عمداً
 * برعکس است (پنجره پیش از پس‌زمینه) تا ثابت شود اگر فوکوس در لحظه‌ی cleanup به‌خاطر
 * inert موفق نشود، پس از پایان commit دوباره تلاش می‌شود و فوکوس گم نمی‌شود.
 */

const nativeFocus = HTMLElement.prototype.focus;

beforeEach(() => {
  // همان شبیه‌سازی رفتار مرورگر: focus() روی عنصر داخل inert نادیده گرفته می‌شود.
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
    if (this.closest('[inert]')) return;
    nativeFocus.call(this, options);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function TestDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useDialogA11y(isOpen, onClose);
  if (!isOpen) return null;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="پنجره آزمون" tabIndex={-1}>
      <button type="button">دکمه داخل پنجره</button>
    </div>
  );
}

function DialogBeforeBackground() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <TestDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <div inert={isOpen}>
        <button type="button" onClick={() => setIsOpen(true)}>
          باز کردن پنجره
        </button>
      </div>
    </>
  );
}

describe('useDialogA11y — بازگشت فوکوس وقتی inert دیرتر برداشته می‌شود', () => {
  it('فوکوس پس از پایان commit به دکمه بازکننده برمی‌گردد', async () => {
    render(<DialogBeforeBackground />);
    const opener = screen.getByRole('button', { name: 'باز کردن پنجره' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'پنجره آزمون' });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener.closest('[inert]')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
