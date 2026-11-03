import { CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as bookingsApi from '../api/bookings.js';
import { getStoreProduct } from '../api/store.js';
import { Seo } from '../components/Seo.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Container } from '../components/ui/Container.jsx';
import { Input } from '../components/ui/Input.jsx';
import { SafeImage } from '../components/ui/SafeImage.jsx';
import { ErrorState, LoadingState, Spinner } from '../components/ui/States.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useCart } from '../features/cart/CartContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { fieldErrorsFromApi } from '../lib/forms.js';
import { formatPrice, formatTotal } from '../lib/format.js';

const EMPTY = { name: '', mobile: '', line1: '', line2: '', city: '', state: '', postalCode: '' };

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Enter your name.';
  if (f.mobile.trim().length < 6 || !/^[0-9+()\-\s]+$/.test(f.mobile)) e.mobile = 'Enter a valid mobile number.';
  if (f.line1.trim().length < 3) e.line1 = 'Enter the street address.';
  if (f.city.trim().length < 2) e.city = 'Enter the city.';
  if (f.state.trim().length < 2) e.state = 'Enter the state.';
  if (!/^[A-Za-z0-9 -]{3,10}$/.test(f.postalCode.trim())) e.postalCode = 'Enter a valid postal code.';
  return e;
}

/** Book Now: one product (?product=slug&quantity=n) or the whole cart. No payment is taken. */
export default function BookingPage() {
  const { user } = useAuth();
  const { cart, loading: cartLoading, reload } = useCart();
  const [params] = useSearchParams();
  const slug = params.get('product');
  const quantity = Math.min(Math.max(Number(params.get('quantity')) || 1, 1), 10);

  const product = useAsync((signal) => (slug ? getStoreProduct(slug, signal) : Promise.resolve(null)), [slug]);
  const saved = useAsync((signal) => bookingsApi.listAddresses(signal), []);
  const [form, setForm] = useState({ ...EMPTY, name: user?.name ?? '', mobile: user?.phone ?? '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const sending = useRef(false); // synchronous lock: a double click can never send two requests

  // Pre-fill from the default saved address once; the customer can change everything.
  useEffect(() => {
    const a = saved.data?.addresses?.find((x) => x.isDefault) ?? saved.data?.addresses?.[0];
    if (a) setForm((f) => ({ ...f, name: f.name || a.name, mobile: f.mobile || a.phone, line1: f.line1 || a.line1, line2: f.line2 || (a.line2 ?? ''), city: f.city || a.city, state: f.state || a.state, postalCode: f.postalCode || a.postalCode }));
  }, [saved.data]);

  const p = product.data?.product;
  const lines = slug
    ? p ? [{ productId: p.id, name: p.name, price: p.price, quantity: Math.min(quantity, p.maxQuantity || quantity), image: p.primaryImage, available: p.maxQuantity > 0 }] : []
    : cart.lines.map((l) => ({ productId: l.productId, name: l.name, price: l.price, quantity: l.quantity, image: l.image, available: l.available && !l.issue }));
  const total = lines.reduce((sum, l) => sum + Math.round(l.price * 100) * l.quantity, 0) / 100;
  const loading = slug ? product.loading : cartLoading;
  const blocked = lines.length === 0 || lines.some((l) => !l.available);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const field = (key, label, extra) => <Input label={label} value={form[key]} onChange={set(key)} error={errors[key]} {...extra} />;

  const submit = async (event) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length || sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const { booking } = await bookingsApi.createBooking({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        address: { line1: form.line1.trim(), ...(form.line2.trim() && { line2: form.line2.trim() }), city: form.city.trim(), state: form.state.trim(), postalCode: form.postalCode.trim() },
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        ...(!slug && { fromCart: true }),
      });
      setDone(booking);
      if (!slug) reload();
    } catch (error) {
      setErrors({ form: error.message, ...fieldErrorsFromApi(error) });
      if (error.status === 409 && !slug) reload();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (done) {
    return (
      <>
        <Seo title="Booking received" noindex />
        <Container className="py-14 sm:py-20">
          <div className="mx-auto max-w-xl rounded-xl border border-line/80 bg-ivory shadow-soft p-8 text-center" role="status">
            <CheckCircle2 size={44} className="mx-auto text-success" aria-hidden="true" />
            <h1 className="mt-4 text-3xl">Booking received</h1>
            <p className="mt-3 text-muted">Your booking ID is</p>
            <p className="mt-1 font-display text-2xl tracking-wide text-brand-900">{done.bookingId}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted">Status: Pending. We will review it and contact you on {done.customer.mobile}. You have not been charged and nothing is payable online.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button as={Link} to={`/account/bookings/${done.id}`}>View booking</Button>
              <Button as={Link} to="/shop" variant="secondary">Continue browsing</Button>
            </div>
          </div>
        </Container>
      </>
    );
  }

  return (
    <>
      <Seo title="Book now" noindex />
      <section className="border-b border-line">
        <Container className="py-10">
          <h1 className="text-4xl">Book now</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Tell us where to deliver. We will confirm your booking and contact you. No payment is taken on this site.</p>
        </Container>
      </section>
      <Container className="py-10">
        {loading && lines.length === 0 ? <LoadingState /> : product.error ? <ErrorState message="This product could not be loaded." onRetry={product.reload} /> : lines.length === 0 ? (
          <div className="rounded-lg border border-line p-8 text-center">
            <p className="text-muted">There is nothing to book yet.</p>
            <Button as={Link} to="/shop" className="mt-4">Browse products</Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <h2 className="text-2xl">Your details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {field('name', 'Full name', { autoComplete: 'name', required: true })}
                {field('mobile', 'Mobile number', { type: 'tel', autoComplete: 'tel', inputMode: 'tel', required: true })}
              </div>
              <h2 className="pt-2 text-2xl">Delivery address</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {field('line1', 'Address line 1', { autoComplete: 'address-line1', className: 'sm:col-span-2', required: true })}
                {field('line2', 'Address line 2 (optional)', { autoComplete: 'address-line2', className: 'sm:col-span-2' })}
                {field('city', 'City', { autoComplete: 'address-level2', required: true })}
                {field('state', 'State', { autoComplete: 'address-level1', required: true })}
                {field('postalCode', 'Postal code', { autoComplete: 'postal-code', required: true })}
              </div>
            </div>

            <aside aria-label="Booking summary" className="h-fit rounded-xl border border-line/80 bg-ivory shadow-soft p-6 lg:sticky lg:top-24">
              <h2 className="text-xl">Your booking</h2>
              <ul className="mt-4 divide-y divide-line text-sm">
                {lines.map((l) => (
                  <li key={l.productId} className="flex gap-3 py-3">
                    <SafeImage src={l.image?.thumbUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-muted">{l.price ? `${formatPrice(l.price)} × ${l.quantity}` : `Quantity ${l.quantity}`}</p>
                      {!l.available && <p className="text-danger">Unavailable</p>}
                    </div>
                    <p className="font-medium">{formatPrice((Math.round(l.price * 100) * l.quantity) / 100)}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex justify-between border-t border-line pt-3 text-base"><span className="font-medium">Total (displayed prices)</span><span className="font-display text-xl">{formatTotal(total, lines.some((l) => !l.price))}</span></p>
              <p className="mt-3 text-xs leading-relaxed text-muted">This is a booking request, not a payment. Price, delivery and payment are confirmed by us when we contact you.</p>
              {errors.form && <p role="alert" className="mt-4 text-sm text-danger">{errors.form} {!slug && <Link to="/cart" className="underline">Review your cart</Link>}</p>}
              <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || blocked}>{busy && <Spinner size={16} />} Confirm booking</Button>
            </aside>
          </form>
        )}
      </Container>
    </>
  );
}
