import { Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as adminApi from '../../api/admin.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { Table, Td, Th } from '../../components/ui/Table.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { formatDateTime, formatTotal } from '../../lib/format.js';
import { formatAddress } from '../../lib/bookings.js';
import { StatusBadge } from '../../components/store/BookingStatus.jsx';

const StatusPill = ({ active }) => <Badge tone={active ? 'success' : 'danger'}>{active ? 'Active' : 'Deactivated'}</Badge>;

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebouncedValue(search);
  const page = Number(params.get('page')) || 1;
  const filters = { q: params.get('q') ?? '', status: params.get('status') ?? '' };

  const setFilter = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries({ page: 1, ...patch })) {
      if (!v || (k === 'page' && v === 1)) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (q !== filters.q) setFilter({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const { data, loading, error, reload } = useAsync((signal) => adminApi.listCustomers({ ...filters, page, limit: 15 }, signal), [page, filters.q, filters.status]);
  const items = data?.items ?? [];
  const hasFilters = filters.q || filters.status;

  return (
    <>
      <PageHeader title="Customers" description="People who have registered on the store." />
      <Card className="p-0 sm:p-0">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-[2.45rem] text-muted" aria-hidden="true" />
            <Input label="Search" type="search" placeholder="Name, email or phone" className="[&_input]:pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select label="Account status" value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
            <option value="">All customers</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </Select>
        </div>

        {loading && !data ? <LoadingState label="Loading customers..." /> : error ? <ErrorState message={error.message} onRetry={reload} /> : items.length === 0 ? (
          <EmptyState icon={hasFilters ? Search : Users} title={hasFilters ? 'No customers match your filters' : 'No customers yet'} description={hasFilters ? 'Try a different search or filter.' : 'Customers appear here once they register.'} />
        ) : (
          <>
            <Table caption="Customers">
              <thead><tr><Th>Customer</Th><Th className="hidden md:table-cell">Joined</Th><Th>Status</Th><Th className="text-right">Bookings</Th></tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-paper/50">
                    <Td><Link to={`/admin/customers/${c.id}`} className="font-medium text-brand-900 hover:underline">{c.name}</Link><p className="text-xs text-muted">{c.email}</p></Td>
                    <Td className="hidden whitespace-nowrap md:table-cell">{formatDateTime(c.createdAt)}</Td>
                    <Td><StatusPill active={c.isActive} /></Td>
                    <Td className="text-right">{c.bookingCount}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination pagination={data.pagination} onChange={(p) => setFilter({ page: p })} />
          </>
        )}
      </Card>
    </>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync((signal) => adminApi.getCustomer(id, signal), [id]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const c = data?.customer;
  const isAdmin = user?.role === 'admin';

  const toggle = async () => {
    setBusy(true);
    try {
      await adminApi.setCustomerStatus(id, !c.isActive);
      toast.success(c.isActive ? 'Account deactivated. Their sessions have ended.' : 'Account reactivated.');
      setConfirm(false);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title={c.name}
        description={c.email}
        actions={
          <>
            <Link to={`/admin/bookings?customer=${c.id}`} className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium hover:border-brand-300">All bookings</Link>
            {isAdmin && <Button variant={c.isActive ? 'danger' : 'primary'} onClick={() => setConfirm(true)}>{c.isActive ? 'Deactivate account' : 'Reactivate account'}</Button>}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card>
            <h3 className="text-xl">Profile</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Status</dt><dd><StatusPill active={c.isActive} /></dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Phone</dt><dd>{c.phone || '-'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Joined</dt><dd>{formatDateTime(c.createdAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Bookings</dt><dd>{c.bookingCount}</dd></div>
            </dl>
          </Card>
          <Card>
            <h3 className="text-xl">Saved addresses</h3>
            {c.addresses.length === 0 ? <p className="mt-3 text-sm text-muted">No saved addresses.</p> : (
              <ul className="mt-3 space-y-3 text-sm">
                {c.addresses.map((a) => (
                  <li key={a.id}>{formatAddress(a).map((l, i) => <span key={i} className={i === 0 ? 'block font-medium' : 'block text-muted'}>{l}</span>)}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card>
          <h3 className="text-xl">Recent bookings</h3>
          {c.recentBookings.length === 0 ? <p className="mt-3 text-sm text-muted">No bookings yet.</p> : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {c.recentBookings.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/bookings/${o.id}`} className="font-medium text-brand-900 hover:underline">{o.bookingId}</Link>
                    <p className="text-xs text-muted">{formatDateTime(o.createdAt)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                  <span className="font-medium">{formatTotal(o.total, o.items.some((i) => !i.price))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={confirm}
        title={c.isActive ? 'Deactivate this account?' : 'Reactivate this account?'}
        description={c.isActive ? 'They will be signed out everywhere and will not be able to sign in. Their bookings are kept.' : 'They will be able to sign in again.'}
        confirmLabel={c.isActive ? 'Deactivate' : 'Reactivate'}
        tone={c.isActive ? 'danger' : 'primary'}
        busy={busy}
        onConfirm={toggle}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
