import { useEffect, useState } from 'react';
import { adminLogout, fetchAdminSession } from './adminApi';
import { LoginView } from './LoginView';
import { OrdersView } from './OrdersView';

type AuthState = { status: 'checking' } | { status: 'loggedOut' } | { status: 'loggedIn'; csrfToken: string };

/**
 * ریشهٔ پنل مدیر — سند عملیاتی، بخش ۶ و ۱۵ (PR#4).
 *
 * این کامپوننت مستقل از سایت اصلی (App.tsx) است و روی مسیر /admin سوار
 * می‌شود (src/main.tsx). با سایت نمایشیِ مشتری کاری ندارد و از localStorage
 * دمو استفاده نمی‌کند — همه‌چیز از API واقعی سرور می‌آید.
 */
export function AdminApp() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });

  useEffect(() => {
    // اگر کوکی نشست هنوز معتبر باشد (مثلاً بعد از رفرش صفحه)، csrfToken را دوباره می‌گیرد.
    fetchAdminSession()
      .then((result) => setAuth({ status: 'loggedIn', csrfToken: result.csrfToken }))
      .catch(() => setAuth({ status: 'loggedOut' }));
  }, []);

  const handleLogout = async () => {
    if (auth.status !== 'loggedIn') return;
    try {
      await adminLogout(auth.csrfToken);
    } catch {
      // حتی اگر درخواست خروج شکست بخورد، کوکی ممکن است منقضی شده باشد؛
      // کاربر را به صفحهٔ ورود برمی‌گردانیم و اگر نشست هنوز زنده بود، دوباره تلاش می‌کند.
    } finally {
      setAuth({ status: 'loggedOut' });
    }
  };

  if (auth.status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        در حال بررسی نشست...
      </div>
    );
  }

  if (auth.status === 'loggedOut') {
    return <LoginView onLoggedIn={(csrfToken) => setAuth({ status: 'loggedIn', csrfToken })} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-sm font-bold text-slate-900">پنل مدیر پاک‌شو</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs font-medium text-slate-500 hover:text-rose-600"
        >
          خروج
        </button>
      </header>
      <main className="p-4">
        <OrdersView csrfToken={auth.csrfToken} />
      </main>
    </div>
  );
}
