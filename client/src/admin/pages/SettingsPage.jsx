import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as adminApi from '../../api/admin.js';
import { SafeImage } from '../../components/ui/SafeImage.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ErrorState, LoadingState, Spinner } from '../../components/ui/States.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { setBusinessSettings } from '../../features/business/useBusiness.js';
import { useAsync } from '../../hooks/useAsync.js';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, fieldErrorsFromApi } from '../../lib/forms.js';

const toForm = (s) => ({
  name: s.business.name ?? '',
  tagline: s.business.tagline ?? '',
  address: s.business.address ?? '',
  phone: s.business.phone ?? '',
  email: s.business.email ?? '',
  hours: s.business.hours ?? '',
  gstin: s.business.gstin ?? '',
});

const num = (v) => (String(v).trim() === '' ? null : Number(v));

const toBody = (f) => ({
  business: { name: f.name, tagline: f.tagline, address: f.address, phone: f.phone, email: f.email, hours: f.hours, gstin: f.gstin },
});

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e['business.name'] = 'Enter the business name.';
  if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e['business.email'] = 'Enter a valid email address.';
  if (!/^[0-9+()\-\s]*$/.test(f.phone)) e['business.phone'] = 'Use digits, spaces, + ( ) or - only.';
  if (f.gstin.trim() && !/^[0-9A-Za-z]{15}$/.test(f.gstin.trim())) e['business.gstin'] = 'A GSTIN has 15 letters and digits.';
  return e;
}

function LogoCard({ logo, onChange }) {
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return toast.error('Use a JPEG, PNG or WebP image.');
    if (file.size > MAX_IMAGE_BYTES) return toast.error('The image is larger than 5 MB.');
    setBusy(true);
    try {
      onChange((await adminApi.uploadLogo(file)).settings);
      toast.success('Logo updated.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      onChange((await adminApi.removeLogo()).settings);
      toast.success('Logo removed.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 className="text-xl">Logo</h3>
      <p className="mt-1 text-sm text-muted">Shown in the site header and footer. Saved immediately. JPEG, PNG or WebP, up to 5 MB.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="grid h-20 w-40 place-items-center rounded-lg border border-line bg-paper p-2">
          {logo?.url ? <SafeImage src={logo.url} alt="Current logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted">No logo uploaded</span>}
        </div>
        <input ref={input} type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} className="sr-only" aria-label="Upload logo" onChange={(e) => upload(e.target.files?.[0])} />
        <Button type="button" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Spinner size={16} /> : <ImagePlus size={16} aria-hidden="true" />} {logo?.url ? 'Replace logo' : 'Upload logo'}
        </Button>
        {logo?.url && <Button type="button" variant="ghost" disabled={busy} onClick={remove}><Trash2 size={16} aria-hidden="true" /> Remove</Button>}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync((signal) => adminApi.getSettings(signal), []);
  const [form, setForm] = useState(null);
  const [logo, setLogo] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(toForm(data.settings));
      setLogo(data.settings.business.logo);
    }
  }, [data]);

  if (user?.role !== 'admin') {
    return (
      <>
        <PageHeader title="Store settings" />
        <Card><p className="text-sm text-muted">Only the store administrator can view or change these settings.</p></Card>
      </>
    );
  }
  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!form) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const field = (key, errKey) => ({ value: form[key], onChange: set(key), error: errors[errKey] });

  const save = async (event) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return toast.error('Please fix the highlighted fields.');
    setSaving(true);
    try {
      const { settings } = await adminApi.saveSettings(toBody(form));
      setForm(toForm(settings));
      setBusinessSettings(publicShape(settings));
      toast.success('Settings saved.');
    } catch (e) {
      setErrors({ ...fieldErrorsFromApi(e) });
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };


  return (
    <form onSubmit={save} noValidate className="space-y-6">
      <PageHeader
        title="Store settings"
        description="Business details and logo shown on the site. Nothing here is pre-filled with assumed values."
        actions={<Button type="submit" disabled={saving}>{saving && <Spinner size={16} />} Save settings</Button>}
      />

      <LogoCard logo={logo} onChange={(s) => { setLogo(s.business.logo); setBusinessSettings(publicShape(s)); }} />

      <Card>
        <h3 className="text-xl">Business details</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Business name" required {...field('name', 'business.name')} />
          <Input label="Tagline" {...field('tagline', 'business.tagline')} />
          <Input label="Phone" type="tel" {...field('phone', 'business.phone')} />
          <Input label="Email" type="email" {...field('email', 'business.email')} />
          <Textarea label="Address" rows={3} fieldClassName="sm:col-span-2" {...field('address', 'business.address')} />
          <Input label="Business hours" {...field('hours', 'business.hours')} />
          <Input label="GSTIN" hint="Optional. Only the format is checked." {...field('gstin', 'business.gstin')} />
        </div>
      </Card>

      <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving && <Spinner size={16} />} Save settings</Button></div>
    </form>
  );
}

/** Admin settings -> the shape the public endpoint returns, so the open site updates without a reload. */
function publicShape(s) {
  return {
    name: s.business.name,
    tagline: s.business.tagline,
    address: s.business.address,
    phone: s.business.phone,
    email: s.business.email,
    hours: s.business.hours,
    logo: s.business.logo?.url ? { url: s.business.logo.url, thumbUrl: s.business.logo.thumbUrl } : null,
  };
}
