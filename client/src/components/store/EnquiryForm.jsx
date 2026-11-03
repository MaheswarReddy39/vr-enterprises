import { CheckCircle2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { submitEnquiry } from '../../api/store.js';
import { fieldErrorsFromApi } from '../../lib/forms.js';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Spinner } from '../ui/States.jsx';
import { Textarea } from '../ui/Textarea.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEnquiry(v) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Please enter your name.';
  if (!EMAIL.test(v.email.trim())) e.email = 'Please enter a valid email address.';
  if (v.phone.trim() && !/^[0-9+()\-\s]{6,20}$/.test(v.phone.trim())) e.phone = 'Use digits, spaces, + ( ) or - only.';
  if (v.message.trim().length < 10) e.message = 'Please write at least 10 characters.';
  return e;
}

const fieldIds = { name: 'enq-name', email: 'enq-email', phone: 'enq-phone', message: 'enq-message' };

/** Public enquiry form. `product` ({ id, name }) optionally links the enquiry to a product. */
export function EnquiryForm({ product, idPrefix = 'enq', tone = 'light' }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', message: '', website: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [formError, setFormError] = useState('');
  const summary = useRef(null);
  const id = (key) => `${idPrefix}-${key}`;
  const set = (patch) => setValues((v) => ({ ...v, ...patch }));

  const submit = async (event) => {
    event.preventDefault();
    const found = validateEnquiry(values);
    setErrors(found);
    setFormError('');
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(id(first))?.focus();

    setStatus('sending');
    try {
      await submitEnquiry({
        name: values.name.trim(),
        email: values.email.trim(),
        ...(values.phone.trim() && { phone: values.phone.trim() }),
        message: values.message.trim(),
        ...(product?.id && { product: product.id }),
        ...(values.website && { website: values.website }),
      });
      setStatus('sent');
    } catch (error) {
      const mapped = fieldErrorsFromApi(error);
      setErrors(mapped);
      setFormError(Object.keys(mapped).length ? 'Please check the highlighted fields.' : error.message);
      setStatus('idle');
      requestAnimationFrame(() => summary.current?.focus());
    }
  };

  if (status === 'sent') {
    return (
      <div role="status" className="rounded-xl border border-success/30 bg-success/5 p-6">
        <CheckCircle2 className="text-success" size={28} aria-hidden="true" />
        <h3 className="mt-3 text-xl">Thank you, your enquiry has been sent.</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">We have received your message and will reply to the email address you gave.</p>
        <Button variant="secondary" size="sm" className="mt-5" onClick={() => { setValues({ name: '', email: '', phone: '', message: '', website: '' }); setStatus('idle'); }}>
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={tone === 'dark' ? 'space-y-4' : 'space-y-4'} aria-label="Enquiry form">
      {product && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
          Enquiring about: <strong>{product.name}</strong>
        </p>
      )}
      {formError && (
        <p ref={summary} tabIndex={-1} role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id={id('name')} label="Your name" autoComplete="name" required value={values.name} error={errors.name} maxLength={100} onChange={(e) => set({ name: e.target.value })} />
        <Input id={id('email')} label="Email" type="email" autoComplete="email" required value={values.email} error={errors.email} maxLength={254} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <Input id={id('phone')} label="Phone (optional)" type="tel" autoComplete="tel" value={values.phone} error={errors.phone} maxLength={20} onChange={(e) => set({ phone: e.target.value })} />
      <Textarea id={id('message')} label="Message" rows={5} required value={values.message} error={errors.message} maxLength={2000} hint={`${values.message.length}/2000`} onChange={(e) => set({ message: e.target.value })} />

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set({ website: e.target.value })} />
        </label>
      </div>

      <Button type="submit" disabled={status === 'sending'}>
        {status === 'sending' && <Spinner size={16} />} Send enquiry
      </Button>
    </form>
  );
}
