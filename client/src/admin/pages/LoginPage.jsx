import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Spinner } from '../../components/ui/States.jsx';
import { Wordmark } from '../../components/ui/Wordmark.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';

export default function LoginPage() {
  const { status, expired, login, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(location.state?.expired || expired ? 'Your session expired. Please sign in again.' : '');
  const [busy, setBusy] = useState(false);

  const destination = location.state?.from?.startsWith('/admin') ? location.state.from : '/admin';
  if (status === 'authenticated' && isAdmin) return <Navigate to={destination} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.email.trim()) next.email = 'Enter your email address.';
    if (!form.password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) {
      document.getElementById(next.email ? 'login-email' : 'login-password')?.focus();
      return;
    }

    setBusy(true);
    try {
      await login(form.email.trim(), form.password, { adminOnly: true });
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="bg-navy-glow relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <span aria-hidden="true" className="ripple absolute size-[34rem] rounded-full border border-accent-300/25" />
      <span aria-hidden="true" className="ripple absolute size-[34rem] rounded-full border border-brand-300/25 [animation-delay:2.5s]" />
      <div className="page-enter relative w-full max-w-md rounded-2xl bg-white p-7 shadow-soft sm:p-9">
        <Wordmark className="h-11" />
        <h1 className="mt-8 text-3xl">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted">Sign in to manage products, stock and categories.</p>

        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          {status === 'authenticated' && !isAdmin && !formError && (
            <p role="status" className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-muted">You are signed in as a customer. Sign in with an administrator account to open the dashboard.</p>
          )}
          {formError && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
          <Input
            id="login-email"
            label="Email"
            type="email"
            autoComplete="username"
            value={form.email}
            error={errors.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            id="login-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            error={errors.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Spinner size={16} />} Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
