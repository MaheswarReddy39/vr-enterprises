import { Package, Plus, Search, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as adminApi from '../../api/admin.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SafeImage } from '../../components/ui/SafeImage.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { Table, Td, Th } from '../../components/ui/Table.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { cn } from '../../lib/cn.js';
import { formatPrice } from '../../lib/format.js';
import { ProductStatusBadge, StockBadge } from '../components/StatusBadges.jsx';

export default function ProductsPage({ featuredOnly = false }) {
  const toast = useToast();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const [confirm, setConfirm] = useState(null); // { type: 'archive' | 'delete', product }
  const [busy, setBusy] = useState(false);

  const page = Number(params.get('page')) || 1;
  const filters = {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    category: params.get('category') ?? '',
    stock: params.get('stock') ?? '',
    sort: params.get('sort') ?? 'newest',
  };

  const setFilter = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries({ page: 1, ...patch })) {
      if (value === '' || value === undefined || (key === 'page' && value === 1)) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debouncedSearch !== filters.q) setFilter({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const categories = useAsync((signal) => adminApi.listCategories({ limit: 100 }, signal), []);
  const { data, loading, error, reload } = useAsync(
    (signal) => adminApi.listProducts({ ...filters, page, limit: 15, featured: featuredOnly ? 'true' : undefined }, signal),
    [page, filters.q, filters.status, filters.category, filters.stock, filters.sort, featuredOnly],
  );

  const toggleFeatured = async (product) => {
    try {
      await adminApi.updateProduct(product._id, { isFeatured: !product.isFeatured });
      toast.success(product.isFeatured ? `"${product.name}" is no longer featured.` : `"${product.name}" is now featured.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const runConfirmed = async () => {
    setBusy(true);
    try {
      const { type, product } = confirm;
      if (type === 'delete') await adminApi.deleteProduct(product._id);
      else await adminApi.updateProduct(product._id, { status: product.status === 'archived' ? 'draft' : 'archived' });
      toast.success(type === 'delete' ? 'Product deleted.' : product.status === 'archived' ? 'Product restored as draft.' : 'Product archived.');
      setConfirm(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = filters.q || filters.status || filters.category || filters.stock;
  const items = data?.items ?? [];
  const isAdmin = user.role === 'admin';

  return (
    <>
      <PageHeader
        title={featuredOnly ? 'Featured products' : 'Products'}
        description={featuredOnly ? 'Products highlighted on the storefront. Toggle the star to add or remove one.' : 'Create and manage your catalogue.'}
        actions={
          <Button as={Link} to="/admin/products/new">
            <Plus size={18} /> New product
          </Button>
        }
      />

      <Card className="p-0 sm:p-0">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-[2.45rem] text-muted" aria-hidden="true" />
            <Input label="Search" type="search" placeholder="Name or SKU" className="[&_input]:pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select label="Status" value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
          <Select label="Category" value={filters.category} onChange={(e) => setFilter({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.data?.items.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Stock" value={filters.stock} onChange={(e) => setFilter({ stock: e.target.value })}>
            <option value="">Any stock level</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
          <Select label="Sort by" value={filters.sort} onChange={(e) => setFilter({ sort: e.target.value })}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently updated</option>
            <option value="name">Name (A-Z)</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="stock_asc">Stock: low to high</option>
          </Select>
        </div>

        {loading && !data ? (
          <LoadingState label="Loading products..." />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : items.length === 0 ? (
          hasFilters ? (
            <EmptyState icon={Search} title="No products match your filters" description="Try a different search or clear the filters." action={<Button variant="secondary" onClick={() => { setSearch(''); setParams({}, { replace: true }); }}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={Package}
              title={featuredOnly ? 'No featured products yet' : 'No products yet'}
              description={featuredOnly ? 'Open the Products list and click the star on any product to feature it.' : 'Add your first product to start building the catalogue.'}
              action={!featuredOnly && <Button as={Link} to="/admin/products/new"><Plus size={18} /> New product</Button>}
            />
          )
        ) : (
          <div className={cn(loading && 'opacity-60 transition-opacity')} aria-busy={loading}>
            <Table caption="Products">
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th className="hidden md:table-cell">Category</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p._id} className="hover:bg-paper/50">
                    <Td className="max-w-[20rem]">
                      <div className="flex items-center gap-3">
                        {p.primaryImage ? (
                          <SafeImage src={p.primaryImage.thumbUrl} alt="" className="size-12 shrink-0 rounded-lg border border-line object-cover" />
                        ) : (
                          <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-dashed border-line text-muted"><Package size={18} aria-hidden="true" /></span>
                        )}
                        <div className="min-w-0">
                          <Link to={`/admin/products/${p._id}/edit`} className="block truncate font-medium text-brand-900 hover:underline">{p.name}</Link>
                          <p className="text-xs text-muted">{p.sku}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">{p.category?.name ?? '-'}</Td>
                    <Td className="whitespace-nowrap">{formatPrice(p.price)}</Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <span>{p.stock}</span>
                        {p.stockStatus !== 'in' && <StockBadge status={p.stockStatus} />}
                      </div>
                    </Td>
                    <Td><ProductStatusBadge status={p.status} /></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="px-2" aria-pressed={p.isFeatured} aria-label={p.isFeatured ? `Remove ${p.name} from featured` : `Feature ${p.name}`} onClick={() => toggleFeatured(p)}>
                          <Star size={18} className={p.isFeatured ? 'fill-accent-400 text-accent-500' : 'text-muted'} />
                        </Button>
                        <Button as={Link} to={`/admin/products/${p._id}/edit`} variant="ghost" size="sm">Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirm({ type: 'archive', product: p })}>{p.status === 'archived' ? 'Restore' : 'Archive'}</Button>
                        {isAdmin && <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirm({ type: 'delete', product: p })}>Delete</Button>}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={data.pagination} onChange={(next) => setFilter({ page: next })} />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirm}
        busy={busy}
        title={confirm?.type === 'delete' ? 'Delete this product permanently?' : confirm?.product.status === 'archived' ? 'Restore this product?' : 'Archive this product?'}
        description={
          confirm?.type === 'delete'
            ? `"${confirm?.product.name}" and all of its images will be permanently deleted. Stock history is kept. This cannot be undone. Consider archiving instead.`
            : confirm?.product.status === 'archived'
              ? `"${confirm?.product.name}" will return to the catalogue as a draft.`
              : `"${confirm?.product.name}" will be hidden from the storefront but kept in your catalogue. You can restore it any time.`
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete permanently' : confirm?.product.status === 'archived' ? 'Restore' : 'Archive'}
        tone={confirm?.type === 'delete' ? 'danger' : 'primary'}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
