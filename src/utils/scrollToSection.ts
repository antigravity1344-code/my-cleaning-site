/**
 * پیمایش نرم به یک بخش صفحه، به‌طوری‌که ابتدای بخش زیر هدر چسبان قرار بگیرد و عنوانش
 * پشت هدر پنهان نشود (`scrollIntoView` ابتدای بخش را دقیقاً به بالای صفحه می‌برد، یعنی
 * زیر هدر). اندازه‌ها در لحظه‌ی فراخوانی خوانده می‌شوند؛ پس هر چیزی که ارتفاع صفحه یا هدر
 * را عوض می‌کند (مثل منوی موبایل) باید پیش از فراخوانی بسته شده باشد.
 */
export function scrollToSection(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;
  const header = document.querySelector('header');
  const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0;
  const top = element.getBoundingClientRect().top + window.scrollY - headerHeight;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
