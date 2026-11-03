import { Heart } from 'lucide-react';
import { useState } from 'react';
import { useWishlist } from '../../features/wishlist/WishlistContext.jsx';
import { cn } from '../../lib/cn.js';

/** Heart toggle. `variant="icon"` is the compact card version, `"labelled"` the product-page version. */
export function WishlistButton({ product, variant = 'icon', className }) {
  const { has, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const saved = has(product.id);
  const label = saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`;

  const onClick = async () => {
    setBusy(true);
    setMessage('');
    try {
      const nowSaved = await toggle(product.id);
      setMessage(nowSaved ? 'Saved to your wishlist.' : 'Removed from your wishlist.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        aria-label={variant === 'icon' ? label : undefined}
        disabled={busy}
        onClick={onClick}
        className={cn(
          variant === 'icon'
            ? 'grid size-9 place-items-center rounded-full bg-paper/90 text-ink shadow-soft ring-1 ring-line transition hover:bg-paper'
            : 'inline-flex h-12 items-center gap-2 rounded-lg border border-line bg-ivory px-4 text-sm font-medium hover:border-brand-300',
          className,
        )}
      >
        <Heart size={variant === 'icon' ? 18 : 18} className={cn(saved && 'fill-danger text-danger')} aria-hidden="true" />
        {variant === 'labelled' && (saved ? 'Saved to wishlist' : 'Save to wishlist')}
      </button>
      <span className="sr-only" role="status">{message}</span>
    </>
  );
}
