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
    <div className="site-admin grid place-items-center">
      <form
        onSubmit={handleSubmit}
        className="admin-card w-full max-w-sm space-y-4 p-6"
      >
        <h1 className="text-lg font-bold text-slate-900">ورود پنل مدیر — پاک‌شو</h1>

        <label className="block space-y-1">
          <span className="admin-label font-medium">نام کاربری</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="admin-field w-full"
          />
        </label>

        <label className="block space-y-1">
          <span className="admin-label font-medium">رمز عبور</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="admin-field w-full"
          />
        </label>

        <label className="block space-y-1">
          <span className="admin-label font-medium">کد یک‌بارمصرف (TOTP)</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
            required
            className="admin-field w-full tracking-widest"
          />
        </label>

        {error && (
          <p role="alert" className="admin-error rounded-xl p-2 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="admin-button admin-button-primary w-full"
        >
          {submitting ? 'در حال ورود...' : 'ورود'}
        </button>
      </form>
    </div>
  );
}
