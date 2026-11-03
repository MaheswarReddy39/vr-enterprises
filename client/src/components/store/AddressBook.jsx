import { Plus } from 'lucide-react';
import { useState } from 'react';
import * as bookingsApi from '../../api/bookings.js';
import { fieldErrorsFromApi } from '../../lib/forms.js';
import { formatAddress } from '../../lib/bookings.js';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Spinner } from '../ui/States.jsx';

const blank = { label: '', name: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '' };

export function validateAddress(v) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Enter the recipient name.';
  if (!/^[0-9+()\-\s]{6,20}$/.test(v.phone.trim())) e.phone = 'Enter a phone number (digits, spaces, + ( ) -).';
  if (v.line1.trim().length < 3) e.line1 = 'Enter the street address.';
  if (v.city.trim().length < 2) e.city = 'Enter the city.';
  if (v.state.trim().length < 2) e.state = 'Enter the state.';
  if (!/^[A-Za-z0-9 -]{3,10}$/.test(v.postalCode.trim())) e.postalCode = 'Enter a valid postal code.';
  return e;
}

function AddressForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial ?? blank);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (event) => {
    event.preventDefault();
    const found = validateAddress(form);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(`addr-${first}`)?.focus();
    setBusy(true);
    const body = Object.fromEntries(Object.entries(form).filter(([k]) => Object.keys(blank).includes(k)).map(([k, v]) => [k, v.trim()]));
    try {
      const { addresses } = initial?._id ? await bookingsApi.updateAddress(initial._id, body) : await bookingsApi.addAddress(body);
      onSaved(addresses);
    } catch (error) {
      setErrors({ form: error.message, ...fieldErrorsFromApi(error) });
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Address form" className="space-y-4 rounded-xl border border-line/80 bg-paper p-4">
      {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id="addr-name" label="Recipient name" autoComplete="name" value={form.name} error={errors.name} onChange={set('name')} />
        <Input id="addr-phone" label="Phone" type="tel" autoComplete="tel" value={form.phone} error={errors.phone} onChange={set('phone')} />
      </div>
      <Input id="addr-line1" label="Address line 1" autoComplete="address-line1" value={form.line1} error={errors.line1} onChange={set('line1')} />
      <Input id="addr-line2" label="Address line 2 (optional)" autoComplete="address-line2" value={form.line2} onChange={set('line2')} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input id="addr-city" label="City" autoComplete="address-level2" value={form.city} error={errors.city} onChange={set('city')} />
        <Input id="addr-state" label="State" autoComplete="address-level1" value={form.state} error={errors.state} onChange={set('state')} />
        <Input id="addr-postalCode" label="Postal code" autoComplete="postal-code" value={form.postalCode} error={errors.postalCode} onChange={set('postalCode')} />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>{busy && <Spinner size={16} />} Save address</Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}

/**
 * Saved delivery addresses. With `selectedId`/`onSelect` it works as a chooser; without them it is
 * a plain manager (account page).
 */
export function AddressBook({ addresses, onChange, selectedId, onSelect }) {
  const [editing, setEditing] = useState(null); // null | 'new' | address
  const [error, setError] = useState('');
  const choose = Boolean(onSelect);

  const saved = (list) => {
    onChange(list);
    setEditing(null);
  };
  const act = async (work) => {
    setError('');
    try {
      onChange((await work()).addresses);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {addresses.length === 0 && editing !== 'new' && <p className="text-sm text-muted">No saved addresses yet.</p>}
      <ul className="space-y-3">
        {addresses.map((a) => (
          <li key={a._id} className="rounded-xl border border-line/80 bg-ivory p-4">
            {editing?._id === a._id ? (
              <AddressForm initial={a} onSaved={saved} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="flex min-w-0 flex-1 cursor-pointer gap-3">
                  {choose && <input type="radio" name="delivery-address" checked={selectedId === a._id} onChange={() => onSelect(a._id)} className="mt-1 size-4 accent-brand-700" aria-label={`Deliver to ${a.name}, ${a.line1}`} />}
                  <span className="min-w-0 text-sm leading-relaxed">
                    {formatAddress(a).map((line, i) => <span key={i} className={i === 0 ? 'block font-medium' : 'block text-muted'}>{line}</span>)}
                    {a.isDefault && <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">Default</span>}
                  </span>
                </label>
                <div className="flex gap-1">
                  {!a.isDefault && <Button variant="ghost" size="sm" onClick={() => act(() => bookingsApi.updateAddress(a._id, { isDefault: true }))}>Make default</Button>}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => act(() => bookingsApi.deleteAddress(a._id))} aria-label={`Delete address for ${a.name}`}>Delete</Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === 'new' ? (
        <AddressForm onSaved={(list) => { saved(list); onSelect?.(list[list.length - 1]._id); }} onCancel={() => setEditing(null)} />
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setEditing('new')} disabled={addresses.length >= 10}><Plus size={16} /> Add an address</Button>
      )}
    </div>
  );
}
