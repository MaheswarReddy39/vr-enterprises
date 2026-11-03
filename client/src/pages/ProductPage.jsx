import { CheckCircle2, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getStoreProduct, listRelatedProducts } from '../api/store.js';
import { Seo } from '../components/Seo.jsx';
import { ProductGallery } from '../components/store/ProductGallery.jsx';
import { QuantityPicker } from '../components/store/QuantityPicker.jsx';
import { WishlistButton } from '../components/store/WishlistButton.jsx';
import { useCart } from '../features/cart/CartContext.jsx';
import { AvailabilityLabel, PriceTag, ProductCard } from '../components/store/ProductCard.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Container } from '../components/ui/Container.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { useAsync } from '../hooks/useAsync.js';

const SCHEMA_AVAILABILITY = {
  in_stock: 'https://schema.org/InStock',
  low_stock: 'https://schema.org/LimitedAvailability',
  out_of_stock: 'https://schema.org/OutOfStock',
};

function ProductNotFound() {
  return (
    <Container className="py-24 text-center">
      <Seo title="Product not found" noindex />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">404</p>
      <h1 className="mt-3 text-4xl">We could not find that product</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">It may no longer be available, or the link may be wrong.</p>
      <Button as={Link} to="/shop" className="mt-8">Browse all products</Button>
    </Container>
  );
}

function Specifications({ groups }) {
  if (groups.length === 0) return <p className="text-sm text-muted">Specifications have not been added for this product yet.</p>;
  return (
    <div className="space-y-8">
      {groups.map((group, gi) => (
        <section key={gi} aria-label={group.group || 'Specifications'}>
          {group.group && <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-accent-600">{group.group}</h3>}
          <dl className="divide-y divide-line border-y border-line">
            {group.items.map((item, ii) => (
              <div key={ii} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <dt className="text-sm text-muted">{item.label}</dt>
                <dd className="text-sm text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState(null); // { type: 'added' | 'error', text }
  const [adding, setAdding] = useState(false);
  const cart = useCart();

  const product = useAsync((signal) => getStoreProduct(slug, signal), [slug]);
  const related = useAsync((signal) => listRelatedProducts(slug, signal), [slug]);
  const p = product.data?.product;

  useEffect(() => {
    setQuantity(1);
    setNote(null);
  }, [slug]);

  const inCart = p ? cart.quantityOf(p.id) : 0;
  const addToCart = async () => {
    setNote(null);
    if (inCart + quantity > p.maxQuantity) {
      const room = Math.max(p.maxQuantity - inCart, 0);
      setNote({ type: 'error', text: room === 0 ? `You already have the maximum available (${p.maxQuantity}) in your cart.` : `You already have ${inCart} in your cart. You can add ${room} more.` });
      return;
    }
    setAdding(true);
    try {
      await cart.add(p.id, quantity);
      setNote({ type: 'added', text: `${quantity > 1 ? `${quantity} × ` : ''}${p.name} added to your cart.` });
    } catch (error) {
      setNote({ type: 'error', text: error.message });
    } finally {
      setAdding(false);
    }
  };

  if (product.loading && !p) {
    return (
      <Container className="py-14" aria-busy="true">
        <div role="status" aria-label="Loading product" className="grid animate-pulse gap-12 lg:grid-cols-2">
          <div className="aspect-square rounded-lg bg-line/70" />
          <div className="space-y-4"><div className="h-4 w-1/4 rounded bg-line/70" /><div className="h-10 w-3/4 rounded bg-line/70" /><div className="h-6 w-1/3 rounded bg-line/70" /><div className="h-32 rounded bg-line/70" /></div>
        </div>
      </Container>
    );
  }
  if (product.error?.status === 404) return <ProductNotFound />;
  if (product.error) {
    return (
      <Container className="py-16">
        <ErrorState message="We could not load this product. Please check your connection and try again." onRetry={product.reload} />
      </Container>
    );
  }

  const unpriced = !(p.price > 0); // the owner has not entered a price: the product cannot be booked yet
  const out = p.availability === 'out_of_stock' || unpriced;
  const description = p.shortDescription || (p.description ? p.description.slice(0, 155) : `${p.name} from VR Enterprises.`);
  const jsonLd = p.isDemo
    ? null
    : {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        sku: p.sku,
        description: p.description || p.shortDescription || undefined,
        image: p.images.map((i) => new URL(i.url, window.location.origin).href),
        offers: { '@type': 'Offer', price: p.price, priceCurrency: 'INR', availability: SCHEMA_AVAILABILITY[p.availability] },
      };

  return (
    <>
      <Seo title={p.name} description={description} image={p.primaryImage ? new URL(p.primaryImage.url, window.location.origin).href : undefined} />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}

      <Container className="py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
          <Link to="/" className="hover:text-ink hover:underline">Home</Link> <span aria-hidden="true">/</span>{' '}
          <Link to="/shop" className="hover:text-ink hover:underline">Shop</Link>
          {p.category && <> <span aria-hidden="true">/</span> <Link to={`/shop?category=${p.category.slug}`} className="hover:text-ink hover:underline">{p.category.name}</Link></>}
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <ProductGallery images={p.images} name={p.name} isDemo={p.isDemo} />

          <div className="lg:sticky lg:top-28 lg:self-start lg:py-2">
            <div className="flex flex-wrap items-center gap-2">
              {p.category && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-600">{p.category.name}</p>}
              {p.isFeatured && <Badge tone="accent">Featured</Badge>}
              {p.isDemo && <Badge>Demo product</Badge>}
            </div>
            <h1 className="mt-3 text-3xl sm:text-[2.6rem]">{p.name}</h1>
            {p.brand && <p className="mt-2 text-sm text-muted">by {p.brand.name}</p>}

            <div className="mt-6"><PriceTag product={p} size="lg" /></div>
            <AvailabilityLabel status={p.availability} className="mt-3" />

            {p.shortDescription && <p className="mt-6 leading-relaxed text-muted">{p.shortDescription}</p>}

            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-8">
              <QuantityPicker value={quantity} max={p.maxQuantity} onChange={setQuantity} disabled={out} />
              <Button size="lg" disabled={out || adding} onClick={addToCart} className="min-w-44 flex-1 sm:flex-none">
                {unpriced ? 'Not available yet' : out ? 'Out of stock' : adding ? 'Adding...' : 'Add to cart'}
              </Button>
              <Button as={Link} to={`/book?product=${p.slug}&quantity=${quantity}`} size="lg" variant="accent" disabled={out} aria-disabled={out} className={out ? 'pointer-events-none min-w-36 opacity-50' : 'min-w-36'}>Book now</Button>
              <WishlistButton product={p} variant="labelled" />
            </div>
            {p.maxQuantity > 0 && p.maxQuantity < 10 && <p className="mt-2 text-xs text-muted">Up to {p.maxQuantity} available per order.</p>}

            <div aria-live="polite">
              {note && (
                <p className={note.type === 'added' ? 'mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success' : 'mt-4 rounded-lg bg-danger/5 p-3 text-sm text-danger'} role={note.type === 'error' ? 'alert' : undefined}>
                  {note.type === 'added' && <CheckCircle2 size={18} aria-hidden="true" />}
                  <span className="text-ink">{note.text}</span>
                  {note.type === 'added' && <Link to="/cart" className="ml-auto font-medium underline">View cart</Link>}
                </p>
              )}
            </div>

            <p className="mt-6 text-sm text-muted">
              Questions? <Link to={`/contact?product=${p.slug}`} className="font-medium text-brand-800 underline underline-offset-4">Ask about this product</Link>
            </p>
            <p className="mt-6 text-xs text-muted">SKU: {p.sku}</p>
          </div>
        </div>

        <div className="mt-20 grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
          <section aria-labelledby="desc-heading" className="border-t border-ink pt-8">
            <h2 id="desc-heading" className="text-3xl">Description</h2>
            {p.description ? (
              <div className="mt-4 space-y-4 leading-relaxed text-muted">
                {p.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
            ) : <p className="mt-4 text-sm text-muted">No description has been added yet.</p>}
            {p.features.length > 0 && (
              <>
                <h3 className="mt-8 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent-600">Key features</h3>
                <ul className="mt-4 grid gap-2.5 text-sm text-ink">
                  {p.features.map((f, i) => <li key={i} className="flex items-start gap-3"><span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-500 text-white"><Check size={12} strokeWidth={3} /></span>{f}</li>)}
                </ul>
              </>
            )}
          </section>
          <section aria-labelledby="spec-heading" className="border-t border-ink pt-8">
            <h2 id="spec-heading" className="mb-6 text-3xl">Specifications</h2>
            <Specifications groups={p.specifications} />
          </section>
        </div>
      </Container>

      {related.data?.items.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-10 border-t border-line/70 bg-sand py-16 sm:py-24">
          <Container>
            <h2 id="related-heading" className="text-3xl sm:text-4xl">You may also like</h2>
            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
              {related.data.items.map((r, i) => <ProductCard key={r.id} product={r} index={i} />)}
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
