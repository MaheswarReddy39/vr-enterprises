import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn.js';
import { formatPrice } from '../../lib/format.js';
import { Badge } from '../ui/Badge.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { SafeImage } from '../ui/SafeImage.jsx';
import { WishlistButton } from './WishlistButton.jsx';

const availability = {
  in_stock: { label: 'In stock', dot: 'bg-success', text: 'text-ink' },
  low_stock: { label: 'Only a few left', dot: 'bg-warning', text: 'text-ink' },
  out_of_stock: { label: 'Out of stock', dot: 'bg-muted/50', text: 'text-muted' },
};

export function AvailabilityLabel({ status, className }) {
  const { label, dot, text } = availability[status] ?? availability.in_stock;
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', text, className)}>
      <span className={cn('size-2 rounded-full', dot)} aria-hidden="true" />
      {label}
    </span>
  );
}

export function PriceTag({ product, size = 'md' }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2', size === 'lg' ? 'text-3xl' : 'text-base')}>
      <span className={cn('font-display font-bold tracking-tight text-ink', size === 'lg' && 'text-4xl')}>{formatPrice(product.price)}</span>
      {product.mrp && (
        <>
          <s className={cn('text-muted', size === 'lg' ? 'text-lg' : 'text-sm')}>
            <span className="sr-only">Original price </span>
            {formatPrice(product.mrp)}
          </s>
          {product.discountPercent >= 1 && <span className="text-sm font-semibold text-accent-500">{product.discountPercent}% off</span>}
        </>
      )}
    </p>
  );
}

/** Product tile used on the home page, the shop and the related-products row. */
export function ProductCard({ product, priority = false, className, index = 0 }) {
  const image = product.primaryImage;
  const out = product.availability === 'out_of_stock';

  return (
    <Reveal as="article" delay={Math.min(index, 5) * 90} className={cn('group relative', className)}>
      <Link to={`/product/${product.slug}`} className="block focus-visible:outline-offset-4">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-sand">
          <SafeImage
            src={image?.thumbUrl}
            alt={image?.alt || product.name}
            width={image?.width}
            height={image?.height}
            loading={priority ? 'eager' : 'lazy'}
            className={cn('size-full object-contain p-6 mix-blend-multiply transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]', out && 'opacity-55')}
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {product.isFeatured && <Badge tone="accent" className="bg-white">Featured</Badge>}
            {product.isDemo && <Badge tone="neutral" className="bg-white">Demo</Badge>}
          </div>
          <span aria-hidden="true" className="absolute bottom-3 right-3 grid size-10 translate-y-2 place-items-center rounded-full bg-ink text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight size={18} />
          </span>
        </div>

        <div className="mt-5 space-y-2">
          {product.category && <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent-500">{product.category.name}</p>}
          <h3 className="link-draw inline font-display text-xl font-bold leading-snug tracking-tight text-ink [background-size:0%_1px] group-hover:[background-size:100%_1px]">{product.name}</h3>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1">
            <PriceTag product={product} />
            <AvailabilityLabel status={product.availability} />
          </div>
        </div>
      </Link>
      <WishlistButton product={product} className="absolute right-3 top-3" />
    </Reveal>
  );
}

/** Placeholder tiles shown while products load. */
export function ProductGridSkeleton({ count = 6 }) {
  return (
    <div role="status" aria-label="Loading products" className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true">
          <div className="aspect-[4/5] animate-pulse rounded-xl bg-sand" />
          <div className="mt-5 space-y-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-sand" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-sand" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-sand" />
          </div>
        </div>
      ))}
    </div>
  );
}
