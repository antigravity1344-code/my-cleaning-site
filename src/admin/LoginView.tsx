import { FormEvent, useState } from 'react';
import { adminLogin, AdminApiError } from './adminApi';

interface LoginViewProps {
  onLoggedIn: (csrfToken: string) => void;
}

export function LoginView({ onLoggedIn }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await adminLogin(username.trim(), password, totp.trim());
      onLoggedIn(result.csrfToken);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'ورود انجام نشد. دوباره تلاش کنید.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <h1 className="text-lg font-bold text-slate-900">ورود پنل مدیر — پاک‌شو</h1>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">نام کاربری</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">رمز عبور</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">کد یک‌بارمصرف (TOTP)</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'در حال ورود...' : 'ورود'}
        </button>
      </form>
    </div>
  );
}
