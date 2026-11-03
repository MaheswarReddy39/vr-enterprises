import { AlertTriangle, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo.jsx';
import { QuantityPicker } from '../components/store/QuantityPicker.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Container } from '../components/ui/Container.jsx';
import { SafeImage } from '../components/ui/SafeImage.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useCart } from '../features/cart/CartContext.jsx';
import { formatPrice, formatTotal } from '../lib/format.js';

const issueText = {
  out_of_stock: 'This product is currently out of stock. Remove it to continue.',
  unavailable: 'This product is no longer available. Please remove it.',
  quantity_reduced: (line) => `Only ${line.maxQuantity} available, so the quantity was reduced.`,
};

function CartLine({ line, onQuantity, onRemove, busy }) {
  const issue = line.issue ? (typeof issueText[line.issue] === 'function' ? issueText[line.issue](line) : issueText[line.issue]) : null;
  const gone = line.issue === 'unavailable';

  return (
    <li className="grid grid-cols-[5rem_1fr] gap-4 py-6 sm:grid-cols-[7rem_1fr_auto] sm:gap-6">
      <div className="aspect-square overflow-hidden rounded-xl bg-ivory ring-1 ring-line">
        {gone ? <div className="grid size-full place-items-center text-xs text-muted">Unavailable</div> : <SafeImage src={line.image?.thumbUrl} alt="" className="size-full object-contain p-1" />}
      </div>

      <div className="min-w-0">
        {gone ? (
          <p className="font-display text-lg text-muted">Product no longer available</p>
        ) : (
          <>
            <Link to={`/product/${line.slug}`} className="font-display text-lg leading-snug underline-offset-4 hover:underline">{line.name}</Link>
            {line.isDemo && <Badge className="ml-2 align-middle">Demo</Badge>}
            <p className="mt-1 text-sm text-muted">SKU {line.sku}</p>
            <p className="mt-1 text-sm">{line.price ? `${formatPrice(line.price)} each` : formatPrice(line.price)}</p>
          </>
        )}
        {issue && (
          <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> <span className="text-ink">{issue}</span>
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {line.available && (
            <QuantityPicker compact label={`Quantity of ${line.name}`} value={line.quantity} max={line.maxQuantity} disabled={busy} onChange={(q) => onQuantity(line.productId, q)} />
          )}
          <button type="button" onClick={() => onRemove(line.productId)} disabled={busy} className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 hover:text-danger hover:underline disabled:opacity-50">
            <Trash2 size={14} aria-hidden="true" /> Remove<span className="sr-only"> {line.name ?? 'unavailable product'}</span>
          </button>
        </div>
      </div>

      <p className="col-start-2 text-base font-medium sm:col-start-3 sm:row-start-1 sm:text-right">{line.available ? formatPrice(line.lineTotal) : '-'}</p>
    </li>
  );
}

export default function CartPage() {
  const { cart, loading, error, add, setQuantity, remove, clear, reload } = useCart();
  const { status } = useAuth();
  const [actionError, setActionError] = useState('');
  const hasLines = cart.lines.length > 0;
  const blocked = cart.lines.some((l) => !l.available);

  const act = async (work) => {
    setActionError('');
    try {
      await work();
    } catch (e) {
      setActionError(e.message);
    }
  };

  return (
    <>
      <Seo title="Your cart" description="Review the products in your cart." noindex />
      <section className="border-b border-line">
        <Container className="py-10 sm:py-14">
          <h1 className="text-4xl sm:text-5xl">Your cart</h1>
          <p className="mt-3 text-sm text-muted">{cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}</p>
        </Container>
      </section>

      <Container className="py-10 sm:py-14">
        {loading && !hasLines ? (
          <LoadingState label="Loading your cart..." />
        ) : error && !hasLines ? (
          <ErrorState message="We could not load your cart. Please try again." onRetry={reload} />
        ) : !hasLines ? (
          <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Browse the range and add a purifier to get started." action={<Button as={Link} to="/shop">Shop purifiers</Button>} />
        ) : (
          <div className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
            <div>
              {actionError && <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{actionError}</p>}
              <ul className="divide-y divide-line border-y border-line" aria-busy={loading}>
                {cart.lines.map((line) => (
                  <CartLine key={line.productId} line={line} busy={loading} onQuantity={(id, q) => act(() => setQuantity(id, q))} onRemove={(id) => act(() => remove(id))} />
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <Link to="/shop" className="text-sm font-medium text-brand-800 underline underline-offset-4">Continue shopping</Link>
                <button type="button" onClick={() => act(clear)} className="text-sm text-muted underline-offset-4 hover:text-danger hover:underline">Empty cart</button>
              </div>
            </div>

            <aside aria-label="Order summary" className="h-fit rounded-xl border border-line/80 bg-ivory shadow-soft p-6 lg:sticky lg:top-24">
              <h2 className="text-xl">Summary</h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Items</dt><dd>{cart.itemCount}</dd></div>
                <div className="flex justify-between border-t border-line pt-3 text-base"><dt className="font-medium">Total (displayed prices)</dt><dd className="font-display text-xl">{formatTotal(cart.subtotal, cart.lines.some((l) => l.available && !l.price))}</dd></div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted">Booking is a request: no payment is taken online. Prices are checked again when you book.</p>
              {blocked ? (
                <Button className="mt-6 w-full" size="lg" disabled>Book now</Button>
              ) : (
                <Button as={Link} to={status === 'authenticated' ? '/book' : '/account/login'} state={{ from: '/book' }} className="mt-6 w-full" size="lg">
                  {status === 'authenticated' ? 'Book now' : 'Sign in to book'}
                </Button>
              )}
              {blocked && <p className="mt-3 text-xs text-warning">Remove unavailable products before checking out.</p>}
              {status !== 'authenticated' && (
                <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
                  <Link to="/account/login" state={{ from: '/cart' }} className="font-medium text-brand-800 underline">Sign in</Link> to keep your cart on every device.
                </p>
              )}
            </aside>
          </div>
        )}
      </Container>
    </>
  );
}
