import { Check } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import * as accountApi from '../api/account.js';
import { Seo } from '../components/Seo.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Container } from '../components/ui/Container.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Spinner } from '../components/ui/States.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import * as bookingsApi from '../api/bookings.js';
import { AddressBook } from '../components/store/AddressBook.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { fieldErrorsFromApi } from '../lib/forms.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_HINT = 'At least 10 characters with a lower case letter, an upper case letter, a number and a symbol.';

/** Client-side mirror of the server password policy (the server re-checks it). */
export function passwordProblems(password) {
  const p = [];
  if (password.length < 10) p.push('at least 10 characters');
  if (!/[a-z]/.test(password)) p.push('a lower case letter');
  if (!/[A-Z]/.test(password)) p.push('an upper case letter');
  if (!/\d/.test(password)) p.push('a number');
  if (!/[^A-Za-z0-9]/.test(password)) p.push('a symbol');
  return p;
}

function Shell({ title, intro, children, footer }) {
  return (
    <div className="bg-hero-light">
      <Container className="grid items-stretch gap-0 py-10 sm:py-16 lg:grid-cols-[1fr_1.05fr]">
        <aside aria-hidden="true" className="bg-navy-glow relative hidden overflow-hidden rounded-l-xl p-10 text-brand-100 lg:flex lg:flex-col lg:justify-between">
          <span className="ripple absolute -bottom-24 -left-16 size-96 rounded-full border border-accent-400/40" />
          <span className="ripple absolute -bottom-24 -left-16 size-96 rounded-full border border-white/20 [animation-delay:3s]" />
          <img src="/brand/logo-mark.svg" alt="" className="float-slow size-20" />
          <div className="relative">
            <p className="font-display text-3xl font-bold leading-tight tracking-tight text-white">Pure water,<br />simply booked.</p>
            <ul className="mt-8 space-y-3 text-sm">
              {['Save your cart and wishlist', 'Book a purifier in a few steps', 'Follow your booking status'].map((t) => (
                <li key={t} className="flex items-center gap-3"><span className="grid size-5 place-items-center rounded-full bg-accent-400/20 text-accent-300"><Check size={12} strokeWidth={3} /></span>{t}</li>
              ))}
            </ul>
          </div>
        </aside>
        <div className="rounded-xl border border-line bg-white p-7 sm:p-10 lg:rounded-l-none lg:rounded-r-xl">
          <div className="mx-auto w-full max-w-md">
            <h1 className="text-3xl sm:text-4xl">{title}</h1>
            {intro && <p className="mt-2 text-sm text-muted">{intro}</p>}
            <div className="mt-8">{children}</div>
            {footer && <p className="mt-6 text-sm text-muted">{footer}</p>}
          </div>
        </div>
      </Container>
    </div>
  );
}

const ErrorBanner = ({ message }) =>
  message ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{message}</p> : null;

export function AccountLoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const from = location.state?.from?.startsWith('/') && !location.state.from.startsWith('//') ? location.state.from : '/account';

  if (status === 'authenticated') return <Navigate to={from} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!EMAIL.test(form.email.trim())) next.email = 'Enter your email address.';
    if (!form.password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return document.getElementById(next.email ? 'acct-email' : 'acct-password')?.focus();
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(error.message);
      setBusy(false);
    }
  };

  return (
    <>
      <Seo title="Sign in" noindex />
      <Shell title="Sign in" intro="Welcome back." footer={<>New here? <Link to="/account/register" state={location.state} className="font-medium text-brand-800 underline">Create an account</Link></>}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <ErrorBanner message={formError} />
          <Input id="acct-email" label="Email" type="email" autoComplete="username" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input id="acct-password" label="Password" type="password" autoComplete="current-password" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Spinner size={16} />} Sign in</Button>
        </form>
      </Shell>
    </>
  );
}

export function AccountRegisterPage() {
  const { status, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const from = location.state?.from?.startsWith('/') && !location.state.from.startsWith('//') ? location.state.from : '/account';

  if (status === 'authenticated') return <Navigate to={from} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your name.';
    if (!EMAIL.test(form.email.trim())) next.email = 'Please enter a valid email address.';
    if (form.phone.trim() && !/^[0-9+()\-\s]{6,20}$/.test(form.phone.trim())) next.phone = 'Use digits, spaces, + ( ) or - only.';
    const missing = passwordProblems(form.password);
    if (missing.length) next.password = `Your password needs ${missing.join(', ')}.`;
    setErrors(next);
    setFormError('');
    const first = Object.keys(next)[0];
    if (first) return document.getElementById(`reg-${first}`)?.focus();

    setBusy(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, ...(form.phone.trim() && { phone: form.phone.trim() }) });
      navigate(from, { replace: true });
    } catch (error) {
      const mapped = fieldErrorsFromApi(error);
      setErrors(mapped);
      setFormError(Object.keys(mapped).length ? 'Please check the highlighted fields.' : error.message);
      setBusy(false);
    }
  };

  return (
    <>
      <Seo title="Create an account" noindex />
      <Shell title="Create an account" intro="Save your cart and wishlist across devices." footer={<>Already registered? <Link to="/account/login" state={location.state} className="font-medium text-brand-800 underline">Sign in</Link></>}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <ErrorBanner message={formError} />
          <Input id="reg-name" label="Full name" autoComplete="name" value={form.name} error={errors.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input id="reg-email" label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input id="reg-phone" label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} error={errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input id="reg-password" label="Password" type="password" autoComplete="new-password" value={form.password} error={errors.password} hint={PASSWORD_HINT} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Spinner size={16} />} Create account</Button>
        </form>
      </Shell>
    </>
  );
}

export function AccountPage() {
  const { user, setUser, logout, replaceSession } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone ?? '' });
  const [profileMsg, setProfileMsg] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [pwMsg, setPwMsg] = useState(null);
  const [busy, setBusy] = useState('');
  const savedAddresses = useAsync((signal) => bookingsApi.listAddresses(signal), []);
  const [addresses, setAddresses] = useState(null);
  const addressList = addresses ?? savedAddresses.data?.addresses ?? [];

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileMsg(null);
    if (profile.name.trim().length < 2) return setProfileMsg({ error: true, text: 'Please enter your name.' });
    setBusy('profile');
    try {
      const { user: updated } = await accountApi.updateProfile({ name: profile.name.trim(), phone: profile.phone.trim() });
      setUser(updated);
      setProfileMsg({ text: 'Profile saved.' });
    } catch (error) {
      setProfileMsg({ error: true, text: error.message });
    } finally {
      setBusy('');
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPwMsg(null);
    const next = {};
    if (!pw.currentPassword) next.currentPassword = 'Enter your current password.';
    const missing = passwordProblems(pw.newPassword);
    if (missing.length) next.newPassword = `Your new password needs ${missing.join(', ')}.`;
    setPwErrors(next);
    if (Object.keys(next).length) return;
    setBusy('password');
    try {
      replaceSession(await accountApi.changePassword(pw));
      setPw({ currentPassword: '', newPassword: '' });
      setPwMsg({ text: 'Password changed. You have been signed out on your other devices.' });
    } catch (error) {
      const mapped = fieldErrorsFromApi(error);
      setPwErrors(mapped);
      setPwMsg(Object.keys(mapped).length ? null : { error: true, text: error.message });
    } finally {
      setBusy('');
    }
  };

  const signOut = async () => {
    // Leave the protected page first; otherwise the route guard would redirect to the sign-in page mid-logout.
    navigate('/', { replace: true });
    await logout().catch(() => {});
  };

  return (
    <>
      <Seo title="Your account" noindex />
      <section className="border-b border-line">
        <Container className="flex flex-wrap items-end justify-between gap-4 py-10 sm:py-14">
          <div>
            <h1 className="text-4xl sm:text-5xl">Your account</h1>
            <p className="mt-3 text-sm text-muted">{user.email}</p>
          </div>
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </Container>
      </section>

      <Container className="grid gap-8 py-10 lg:grid-cols-2 lg:py-14">
        <Card>
          <h2 className="text-2xl">Profile</h2>
          <form onSubmit={saveProfile} noValidate className="mt-5 space-y-4" aria-label="Profile">
            <Input label="Full name" autoComplete="name" value={profile.name} maxLength={80} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Input label="Phone (optional)" type="tel" autoComplete="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <Input label="Email" value={user.email} disabled hint="Email cannot be changed here." readOnly />
            {profileMsg && <p role={profileMsg.error ? 'alert' : 'status'} className={profileMsg.error ? 'text-sm text-danger' : 'text-sm text-success'}>{profileMsg.text}</p>}
            <Button type="submit" disabled={busy === 'profile'}>{busy === 'profile' && <Spinner size={16} />} Save profile</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-2xl">Change password</h2>
          <form onSubmit={savePassword} noValidate className="mt-5 space-y-4" aria-label="Change password">
            <input type="text" autoComplete="username" value={user.email} readOnly hidden />
            <Input label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} error={pwErrors.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            <Input label="New password" type="password" autoComplete="new-password" value={pw.newPassword} error={pwErrors.newPassword} hint={PASSWORD_HINT} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            {pwMsg && <p role={pwMsg.error ? 'alert' : 'status'} className={pwMsg.error ? 'text-sm text-danger' : 'text-sm text-success'}>{pwMsg.text}</p>}
            <Button type="submit" variant="secondary" disabled={busy === 'password'}>{busy === 'password' && <Spinner size={16} />} Change password</Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-2xl">Delivery addresses</h2>
          <div className="mt-5"><AddressBook addresses={addressList} onChange={setAddresses} /></div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-2xl">Bookings</h2>
          <p className="mt-2 text-sm text-muted">See the status of your product bookings.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link to="/account/bookings" className="font-medium text-brand-800 underline underline-offset-4">My bookings</Link>
            <Link to="/wishlist" className="font-medium text-brand-800 underline underline-offset-4">View wishlist</Link>
            <Link to="/cart" className="font-medium text-brand-800 underline underline-offset-4">View cart</Link>
          </div>
        </Card>
      </Container>
    </>
  );
}
