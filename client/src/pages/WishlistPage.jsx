import { Heart } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as accountApi from '../api/account.js';
import { Seo } from '../components/Seo.jsx';
import { ProductCard, ProductGridSkeleton } from '../components/store/ProductCard.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Container } from '../components/ui/Container.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useCart } from '../features/cart/CartContext.jsx';
import { useWishlist } from '../features/wishlist/WishlistContext.jsx';
import { useAsync } from '../hooks/useAsync.js';

export default function WishlistPage() {
  const { status } = useAuth();
  const { ids } = useWishlist();
  const cart = useCart();
  const [message, setMessage] = useState('');
  const authed = status === 'authenticated';

  // Re-reads whenever the saved ids change, so removing a heart removes the card.
  const { data, loading, error, reload } = useAsync(
    async (signal) => {
      if (status === 'loading') return { items: [] };
      if (ids.length === 0) return { items: [] };
      return authed ? accountApi.getWishlist(signal) : accountApi.lookupProducts(ids, signal);
    },
    [status, ids.join(',')],
  );
  const items = (data?.items ?? []).filter((p) => ids.includes(p.id));

  const addToCart = async (product) => {
    setMessage('');
    try {
      await cart.add(product.id, 1);
      setMessage(`${product.name} added to your cart.`);
    } catch (e) {
      setMessage(e.message);
    }
  };

  return (
    <>
      <Seo title="Wishlist" description="Products you have saved." noindex />
      <section className="border-b border-line">
        <Container className="py-10 sm:py-14">
          <h1 className="text-4xl sm:text-5xl">Wishlist</h1>
          <p className="mt-3 text-sm text-muted">
            {authed ? 'Saved to your account.' : <>Saved on this device. <Link to="/account/login" state={{ from: '/wishlist' }} className="underline">Sign in</Link> to keep it everywhere.</>}
          </p>
        </Container>
      </section>

      <Container className="py-10 sm:py-14">
        <p role="status" className="mb-4 min-h-5 text-sm text-success">{message}</p>
        {loading && !data ? (
          <ProductGridSkeleton count={3} />
        ) : error ? (
          <ErrorState message="We could not load your wishlist." onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState icon={Heart} title="Your wishlist is empty" description="Tap the heart on any product to save it here." action={<Button as={Link} to="/shop">Browse products</Button>} />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4">
            {items.map((p) => (
              <div key={p.id}>
                <ProductCard product={p} />
                <Button variant="secondary" size="sm" className="mt-3 w-full" disabled={p.availability === 'out_of_stock'} onClick={() => addToCart(p)}>
                  {p.availability === 'out_of_stock' ? 'Out of stock' : 'Add to cart'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
