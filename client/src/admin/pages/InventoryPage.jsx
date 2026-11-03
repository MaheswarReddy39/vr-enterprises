import { History, Package, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as adminApi from '../../api/admin.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../../components/ui/States.jsx';
import { Table, Td, Th } from '../../components/ui/Table.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { cn } from '../../lib/cn.js';
import { fieldErrorsFromApi } from '../../lib/forms.js';
import { formatDateTime, formatNumber } from '../../lib/format.js';
import { StockBadge } from '../components/StatusBadges.jsx';

const MAX_STOCK = 1_000_000;
const REASONS = { restock: 'Restock', return: 'Customer return', damage: 'Damaged / lost', correction: 'Stock count correction', other: 'Other', sale: 'Sale' };
const TYPE_LABELS = { initial: 'Opening stock', add: 'Added', remove: 'Removed', set: 'Set to', sale: 'Sale' };

export function newStockPreview(type, current, quantity) {
  if (quantity === '' || !/^\d+$/.test(quantity)) return null;
  const q = Number(quantity);
  return type === 'add' ? current + q : type === 'remove' ? current - q : q;
}

function AdjustModal({ product, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ type: 'add', quantity: '', reason: 'restock', note: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const preview = newStockPreview(form.type, product.stock, form.quantity.trim());

  const submit = async (event) => {
    event.preventDefault();
    const q = form.quantity.trim();
    const next = {};
    if (!/^\d+$/.test(q)) next.quantity = 'Enter a whole number.';
    else if (form.type !== 'set' && Number(q) < 1) next.quantity = 'Quantity must be at least 1.';
    else if (form.type === 'remove' && Number(q) > product.stock) next.quantity = `Only ${product.stock} in stock, so you cannot remove ${q}.`;
    else if (preview > MAX_STOCK) next.quantity = `Stock cannot exceed ${formatNumber(MAX_STOCK)}.`;
    setErrors(next);
    if (next.quantity) return document.getElementById('adj-qty')?.focus();

    setSaving(true);
    try {
      await adminApi.adjustStock(product._id, { type: form.type, quantity: Number(q), reason: form.reason, ...(form.note.trim() && { note: form.note.trim() }) });
      toast.success(`Stock for "${product.name}" is now ${formatNumber(preview)}.`);
      onSaved();
    } catch (error) {
      setErrors({ form: error.message, ...fieldErrorsFromApi(error) });
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title="Adjust stock"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="adjust-form" disabled={saving}>{saving && <Spinner size={16} />} Save adjustment</Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm"><strong>{product.name}</strong> <span className="text-muted">({product.sku})</span><br />Current stock: <strong>{formatNumber(product.stock)}</strong></p>
        {errors.form && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{errors.form}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Adjustment" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, reason: e.target.value === 'add' ? 'restock' : 'correction' })} data-autofocus>
            <option value="add">Add stock</option>
            <option value="remove">Remove stock</option>
            <option value="set">Set exact quantity</option>
          </Select>
          <Input id="adj-qty" label={form.type === 'set' ? 'New quantity' : 'Quantity'} inputMode="numeric" value={form.quantity} error={errors.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        {preview !== null && <p className="text-sm text-muted" aria-live="polite">New stock level: <strong className={cn(preview < 0 ? 'text-danger' : 'text-ink')}>{formatNumber(preview)}</strong></p>}
        <Select label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
          {Object.entries(REASONS).filter(([k]) => k !== 'sale').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Textarea label="Note (optional)" rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} hint="For example a purchase order or invoice number." />
      </form>
    </Modal>
  );
}

function HistoryTable({ productId }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync((signal) => adminApi.listInventoryLogs({ page, limit: 15, product: productId }, signal), [page, productId]);
  if (loading && !data) return <LoadingState label="Loading history..." />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (data.items.length === 0) return <EmptyState icon={History} title="No stock history yet" description="Every stock change will be recorded here." />;
  return (
    <>
      <Table caption="Inventory history">
        <thead><tr><Th>When</Th>{!productId && <Th>Product</Th>}<Th>Change</Th><Th>Balance</Th><Th>Reason</Th><Th className="hidden md:table-cell">By</Th></tr></thead>
        <tbody>
          {data.items.map((log) => (
            <tr key={log._id}>
              <Td className="whitespace-nowrap">{formatDateTime(log.createdAt)}</Td>
              {!productId && <Td><span className="font-medium">{log.productName}</span><p className="text-xs text-muted">{log.sku}</p></Td>}
              <Td className="whitespace-nowrap">
                <span className={cn('font-medium', log.delta > 0 ? 'text-success' : log.delta < 0 ? 'text-danger' : 'text-muted')}>{log.delta > 0 ? '+' : ''}{formatNumber(log.delta)}</span>
                <span className="ml-1 text-xs text-muted">{TYPE_LABELS[log.type]}</span>
              </Td>
              <Td>{formatNumber(log.balanceAfter)}</Td>
              <Td>{REASONS[log.reason] ?? log.reason}{log.note && <p className="text-xs text-muted">{log.note}</p>}</Td>
              <Td className="hidden md:table-cell">{log.performedBy?.name ?? '-'}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination pagination={data.pagination} onChange={setPage} />
    </>
  );
}

export default function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('stock');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search);
  const stock = params.get('stock') ?? '';
  const [adjusting, setAdjusting] = useState(null);
  const [viewing, setViewing] = useState(null);

  useEffect(() => setPage(1), [q, stock]);
  const summary = useAsync((signal) => adminApi.getSummary(signal), []);
  const { data, loading, error, reload } = useAsync(
    (signal) => adminApi.listProducts({ page, limit: 15, q, stock, sort: 'stock_asc' }, signal),
    [page, q, stock],
  );
  const items = data?.items ?? [];

  const tabs = [['stock', 'Stock levels'], ['history', 'History']];

  return (
    <>
      <PageHeader title="Inventory" description="Track stock, adjust quantities and review every change." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ['Products', summary.data?.products.total, ''],
          ['Low stock', summary.data?.inventory.low, 'low'],
          ['Out of stock', summary.data?.inventory.out, 'out'],
        ].map(([label, value, filter]) => (
          <button key={label} type="button" onClick={() => { setTab('stock'); setParams(filter ? { stock: filter } : {}, { replace: true }); }} className="text-left">
            <Card className={cn('transition-shadow hover:shadow-soft', stock === filter && 'ring-2 ring-brand-400')}>
              <p className="text-sm text-muted">{label}</p>
              <p className={cn('mt-1 font-display text-3xl', filter && value > 0 ? 'text-warning' : 'text-brand-900')}>{value === undefined ? '-' : formatNumber(value)}</p>
            </Card>
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="Inventory views" className="mb-4 flex gap-1 border-b border-line">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" type="button" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}
            className={cn('-mb-px border-b-2 px-4 py-2.5 text-sm font-medium', tab === id ? 'border-brand-700 text-brand-900' : 'border-transparent text-muted hover:text-ink')}>
            {label}
          </button>
        ))}
      </div>

      <Card className="p-0 sm:p-0" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'history' ? <HistoryTable /> : (
          <>
            <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-[2.45rem] text-muted" aria-hidden="true" />
                <Input label="Search" type="search" placeholder="Name or SKU" className="[&_input]:pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select label="Stock level" value={stock} onChange={(e) => setParams(e.target.value ? { stock: e.target.value } : {}, { replace: true })}>
                <option value="">All</option>
                <option value="in">In stock</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </Select>
            </div>
            {loading && !data ? <LoadingState label="Loading stock..." /> : error ? <ErrorState message={error.message} onRetry={reload} /> : items.length === 0 ? (
              <EmptyState icon={Package} title={q || stock ? 'No products match your filters' : 'No products yet'} description={q || stock ? 'Try a different search or stock level.' : 'Add products to start tracking stock.'} />
            ) : (
              <>
                <Table caption="Stock levels">
                  <thead><tr><Th>Product</Th><Th>In stock</Th><Th className="hidden sm:table-cell">Alert at</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p._id} className="hover:bg-paper/50">
                        <Td><span className="font-medium">{p.name}</span><p className="text-xs text-muted">{p.sku}</p></Td>
                        <Td className="font-medium">{formatNumber(p.stock)}</Td>
                        <Td className="hidden sm:table-cell">{formatNumber(p.lowStockThreshold)}</Td>
                        <Td><StockBadge status={p.stockStatus} /></Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <Button variant="secondary" size="sm" onClick={() => setAdjusting(p)}>Adjust</Button>
                            <Button variant="ghost" size="sm" aria-label={`History for ${p.name}`} onClick={() => setViewing(p)}><History size={16} /></Button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination pagination={data.pagination} onChange={setPage} />
              </>
            )}
          </>
        )}
      </Card>

      {adjusting && <AdjustModal product={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); reload(); summary.reload(); }} />}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Stock history: ${viewing?.name ?? ''}`} size="lg">
        {viewing && <HistoryTable productId={viewing._id} />}
      </Modal>
    </>
  );
}
