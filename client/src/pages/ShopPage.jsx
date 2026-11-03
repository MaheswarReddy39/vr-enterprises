import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listStoreCategories, listStoreProducts } from '../api/store.js';
import { Seo } from '../components/Seo.jsx';
import { ProductCard, ProductGridSkeleton } from '../components/store/ProductCard.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Container } from '../components/ui/Container.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { useBusiness } from '../features/business/useBusiness.js';
import { useAsync } from '../hooks/useAsync.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { cn } from '../lib/cn.js';

const PAGE_SIZE = 12;
const SORTS = [
  ['featured', 'Featured first'],
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['name', 'Name: A to Z'],
];

function CategoryList({ categories, active, onSelect }) {
  const item = (slug, label, count) => (
    <li key={slug || 'all'}>
      <button
        type="button"
        onClick={() => onSelect(slug)}
        aria-pressed={active === slug}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
          active === slug ? 'bg-brand-900 text-ivory' : 'text-ink hover:bg-brand-50',
        )}
      >
        <span>{label}</span>
        {count !== undefined && <span className={cn('text-xs', active === slug ? 'text-brand-200' : 'text-muted')}>{count}</span>}
      </button>
    </li>
  );
  return (
    <ul className="space-y-1">
      {item('', 'All products')}
      {categories.map((c) => item(c.slug, c.parent ? `${c.name}` : c.name, c.productCount))}
    </ul>
  );
}

export default function ShopPage() {
  const business = useBusiness();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const gridTop = useRef(null);
  const debounced = useDebouncedValue(search, 350);

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sort = SORTS.some(([v]) => v === params.get('sort')) ? params.get('sort') : 'featured';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries({ page: '', ...patch })) {
      if (!value || (key === 'sort' && value === 'featured')) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  // Keep the box in sync when the URL changes elsewhere (header search, back button, "clear").
  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (debounced.trim() !== q) update({ q: debounced.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const categories = useAsync((signal) => listStoreCategories(signal), []);
  const products = useAsync(
    (signal) => listStoreProducts({ q, category, sort, page, limit: PAGE_SIZE }, signal),
    [q, category, sort, page],
  );

  const items = products.data?.items ?? [];
  const pagination = products.data?.pagination;
  const activeCategory = categories.data?.items.find((c) => c.slug === category);
  const hasFilters = Boolean(q || category);
  const heading = activeCategory ? activeCategory.name : 'All water purifiers';

  const goToPage = (next) => {
    update({ page: next > 1 ? String(next) : '' });
    gridTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <Seo
        title={q ? `Search: ${q}` : activeCategory ? `${activeCategory.name}` : 'Shop water purifiers'}
        description={`Browse ${business.name} water purifiers. Compare prices and specifications and check availability.`}
      />

      <section className="border-b border-line">
        <Container className="py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link to="/" className="hover:text-ink hover:underline">Home</Link> <span aria-hidden="true">/</span> <span className="text-ink">Shop</span>
          </nav>
          <h1 className="mt-3 text-4xl sm:text-5xl">{heading}</h1>
          {activeCategory?.description && <p className="mt-3 max-w-2xl text-muted">{activeCategory.description}</p>}
        </Container>
      </section>

      <Container className="grid gap-10 py-10 lg:grid-cols-[15rem_1fr] lg:gap-14 lg:py-14">
        {/* Filters: always visible on large screens, toggled on small ones */}
        <aside aria-label="Filters" className="lg:sticky lg:top-24 lg:self-start">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-line bg-ivory px-4 py-3 text-sm font-medium lg:hidden"
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} aria-hidden="true" /> Filter by category</span>
            <span className="text-muted">{activeCategory ? activeCategory.name : 'All'}</span>
          </button>

          <div id="filter-panel" className={cn('mt-3 lg:mt-0', !filtersOpen && 'hidden lg:block')}>
            <h2 className="mb-3 hidden font-sans text-xs font-semibold uppercase tracking-[0.18em] text-accent-600 lg:block">Categories</h2>
            {categories.loading && !categories.data ? (
              <div role="status" aria-label="Loading categories" className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-line/60" />)}</div>
            ) : categories.error ? (
              <p role="alert" className="text-sm text-danger">Categories could not be loaded. <button type="button" className="underline" onClick={categories.reload}>Retry</button></p>
            ) : (
              <CategoryList categories={categories.data?.items ?? []} active={category} onSelect={(slug) => { update({ category: slug }); setFiltersOpen(false); }} />
            )}
          </div>
        </aside>

        <div>
          <div ref={gridTop} className="scroll-mt-24 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="relative sm:w-72">
              <label htmlFor="shop-search" className="sr-only">Search products</label>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="shop-search"
                type="search"
                value={search}
                placeholder="Search by name or SKU"
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-lg border border-line bg-ivory pl-9 pr-3 text-sm placeholder:text-muted/70 transition-colors hover:border-brand-300 focus:border-brand-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="shop-sort" className="text-sm text-muted">Sort by</label>
              <select
                id="shop-sort"
                value={sort}
                onChange={(e) => update({ sort: e.target.value })}
                className="h-11 rounded-lg border border-line bg-ivory px-3 pr-8 text-sm transition-colors hover:border-brand-300 focus:border-brand-500"
              >
                {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 flex min-h-8 flex-wrap items-center gap-2 text-sm text-muted" aria-live="polite">
            {pagination && <span>{pagination.total} {pagination.total === 1 ? 'product' : 'products'}</span>}
            {q && (
              <button type="button" onClick={() => { setSearch(''); update({ q: '' }); }} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-brand-900 hover:bg-brand-100">
                Search: {q} <X size={14} aria-label="Clear search" />
              </button>
            )}
            {activeCategory && (
              <button type="button" onClick={() => update({ category: '' })} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-brand-900 hover:bg-brand-100">
                {activeCategory.name} <X size={14} aria-label="Clear category filter" />
              </button>
            )}
          </div>

          <div className="mt-6" aria-busy={products.loading}>
            {products.loading && !products.data ? (
              <ProductGridSkeleton count={6} />
            ) : products.error ? (
              <ErrorState message="We could not load the products. Please check your connection and try again." onRetry={products.reload} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={Search}
                title={hasFilters ? 'No products match your search' : 'No products available yet'}
                description={hasFilters ? 'Try a different search term or choose another category.' : 'Please check back soon.'}
                action={hasFilters && <Button variant="secondary" onClick={() => { setSearch(''); setParams({}, { replace: true }); }}>Clear filters</Button>}
              />
            ) : (
              <div className={cn('grid grid-cols-2 gap-x-4 gap-y-10 transition-opacity sm:gap-x-6 lg:grid-cols-3', products.loading && 'opacity-60')}>
                {items.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 3} />)}
              </div>
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-12 rounded-xl border border-line/80 bg-ivory">
              <Pagination pagination={pagination} onChange={goToPage} />
            </div>
          )}
        </div>
      </Container>
    </>
  );
}
