import { ClipboardList, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as bookingsApi from '../../api/bookings.js';
import { StatusBadge } from '../../components/store/BookingStatus.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SafeImage } from '../../components/ui/SafeImage.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../../components/ui/States.jsx';
import { Table, Td, Th } from '../../components/ui/Table.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { formatDateTime, formatPrice, formatTotal } from '../../lib/format.js';
import { BOOKING_STATUS_LABEL, formatAddress } from '../../lib/bookings.js';
import { KIND_LABEL, NotificationBadge } from '../../components/store/NotificationState.jsx';
import { refreshUnreadBookings } from '../unreadBookings.js';
import { RetryButton } from './NotificationsPage.jsx';

export function AdminBookingsPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebouncedValue(search);
  const page = Number(params.get('page')) || 1;
  const filters = { q: params.get('q') ?? '', status: params.get('status') ?? '', unread: params.get('unread') ?? '', customer: params.get('customer') ?? '' };

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

  const { data, loading, error, reload } = useAsync((signal) => bookingsApi.listBookings({ ...filters, page, limit: 15 }, signal), [page, filters.q, filters.status, filters.unread, filters.customer]);
  const items = data?.items ?? [];
  const hasFilters = filters.q || filters.status || filters.unread || filters.customer;

  const markAll = async () => {
    try {
      await bookingsApi.markAllBookingsRead();
      refreshUnreadBookings();
      reload();
      toast.success('All bookings marked as read.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Product bookings from customers. New ones are highlighted until you open or mark them read."
        actions={data?.unreadCount > 0 && <Button variant="secondary" onClick={markAll}>Mark all {data.unreadCount} as read</Button>}
      />
      <Card className="p-0 sm:p-0">
        {filters.customer && (
          <p className="flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-2 text-sm">
            Showing one customer&apos;s bookings.
            <button type="button" className="text-brand-800 underline-offset-4 hover:underline" onClick={() => setFilter({ customer: '' })}>Show all bookings</button>
          </p>
        )}
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-[2.45rem] text-muted" aria-hidden="true" />
            <Input label="Search" type="search" placeholder="Booking ID, name, mobile or email" className="[&_input]:pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select label="Status" value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
            <option value="">All statuses</option>
            {Object.entries(BOOKING_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select label="Read state" value={filters.unread} onChange={(e) => setFilter({ unread: e.target.value })}>
            <option value="">All bookings</option>
            <option value="true">Unread only</option>
          </Select>
        </div>

        {loading && !data ? <LoadingState label="Loading bookings..." /> : error ? <ErrorState message={error.message} onRetry={reload} /> : items.length === 0 ? (
          <EmptyState icon={hasFilters ? Search : ClipboardList} title={hasFilters ? 'No bookings match your filters' : 'No bookings yet'} description={hasFilters ? 'Try a different search or filter.' : 'Bookings appear here as soon as customers submit them.'} />
        ) : (
          <>
            <Table caption="Bookings">
              <thead><tr><Th>Booking</Th><Th className="hidden md:table-cell">Customer</Th><Th className="hidden sm:table-cell">Items</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className={b.isRead ? 'hover:bg-paper/50' : 'bg-accent-50/60 hover:bg-accent-50'}>
                    <Td>
                      <Link to={`/admin/bookings/${b.id}`} className="font-medium text-brand-900 hover:underline">{b.bookingId}</Link>
                      {!b.isRead && <Badge tone="accent" className="ml-2">New</Badge>}
                      <p className="text-xs text-muted">{formatDateTime(b.createdAt)}</p>
                    </Td>
                    <Td className="hidden md:table-cell">{b.customer?.name}<p className="text-xs text-muted">{b.customer?.mobile}</p></Td>
                    <Td className="hidden max-w-60 truncate sm:table-cell">{b.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}</Td>
                    <Td><StatusBadge status={b.status} /></Td>
                    <Td className="whitespace-nowrap text-right">{formatTotal(b.total, b.items.some((i) => !i.price))}</Td>
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

const NEXT = { pending: ['confirmed', 'rejected'], confirmed: ['processing'], processing: ['completed'] };
const ACTION_LABEL = { confirmed: 'Confirm booking', rejected: 'Reject booking', processing: 'Start processing', completed: 'Mark completed' };

export function AdminBookingDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync((signal) => bookingsApi.getBooking(id, signal).then((r) => { refreshUnreadBookings(); return r; }), [id]);
  const b = data?.booking;
  const messages = useAsync((signal) => bookingsApi.listNotifications({ booking: id, limit: 20 }, signal), [id, data?.booking?.status]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null); // 'confirmed' | 'rejected'

  const run = async (name, work, success) => {
    setBusy(name);
    try {
      await work();
      toast.success(success);
      setConfirm(null);
      setNote('');
      refreshUnreadBookings();
      reload();
    } catch (e) {
      toast.error(e.message);
      setConfirm(null);
      reload();
    } finally {
      setBusy('');
    }
  };
  const change = (status) => run(status, () => bookingsApi.setBookingStatus(id, { status, ...(note.trim() && { note: note.trim() }) }), `Booking ${BOOKING_STATUS_LABEL[status].toLowerCase()}.`);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const options = NEXT[b.status] ?? [];

  return (
    <>
      <PageHeader
        title={b.bookingId}
        description={`Booked ${formatDateTime(b.createdAt)}`}
        actions={
          <>
            <StatusBadge status={b.status} />
            <Button variant="secondary" size="sm" disabled={busy === 'read'} onClick={() => run('read', () => bookingsApi.setBookingRead(id, !b.isRead), b.isRead ? 'Marked as unread.' : 'Marked as read.')}>
              {b.isRead ? 'Mark as unread' : 'Mark as read'}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h3 className="text-xl">Items</h3>
            <ul className="mt-3 divide-y divide-line text-sm">
              {b.items.map((i) => (
                <li key={i.productId} className="flex gap-3 py-3">
                  <SafeImage src={i.imageThumbUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1"><p className="font-medium">{i.name}</p><p className="text-muted">{i.sku} · {formatPrice(i.price)} × {i.quantity}</p></div>
                  <p className="font-medium">{formatPrice(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-line pt-3 text-base"><span className="font-medium">Total (displayed prices)</span><span className="font-display text-xl">{formatTotal(b.total, b.items.some((i) => !i.price))}</span></p>
            <p className="mt-2 text-xs text-muted">{b.stockDeducted ? 'Stock has been deducted for this booking.' : 'Stock is deducted only when you confirm the booking.'}</p>
          </Card>

          <Card>
            <h3 className="text-xl">Update status</h3>
            {options.length === 0 ? <p className="mt-3 text-sm text-muted">This booking is {BOOKING_STATUS_LABEL[b.status].toLowerCase()}. No further action is possible.</p> : (
              <>
                <Textarea label="Note (optional)" rows={2} className="mt-3" hint="Visible to the customer, for example the reason for rejecting." value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
                <div className="mt-4 flex flex-wrap gap-3">
                  {options.map((s) => (
                    <Button key={s} variant={s === 'rejected' ? 'danger' : 'primary'} disabled={Boolean(busy)} onClick={() => (s === 'confirmed' || s === 'rejected' ? setConfirm(s) : change(s))}>
                      {busy === s && <Spinner size={16} />} {ACTION_LABEL[s]}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-xl">Customer</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Name</dt><dd>{b.customer.name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Mobile</dt><dd><a href={`tel:${b.customer.mobile.replace(/[^\d+]/g, '')}`} className="underline underline-offset-4">{b.customer.mobile}</a></dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="break-all">{b.customer.email}</dd></div>
            </dl>
            <Link to={`/admin/customers/${b.userId}`} className="mt-3 inline-block text-sm text-brand-800 underline-offset-4 hover:underline">View customer</Link>
            <h3 className="mt-5 text-xl">Delivery address</h3>
            <p className="mt-2 text-sm leading-relaxed">{formatAddress(b.deliveryAddress).map((l, i) => <span key={i} className="block text-muted">{l}</span>)}</p>
          </Card>
          <Card>
            <h3 className="text-xl">WhatsApp messages</h3>
            {messages.data?.items.length ? (
              <ul className="mt-3 space-y-3 text-sm">
                {messages.data.items.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{KIND_LABEL[n.kind]}{n.status && <span className="text-muted"> · {BOOKING_STATUS_LABEL[n.status] ?? n.status}</span>}
                      {n.lastError && <span className="block max-w-xs text-xs text-muted">{n.lastError}</span>}
                    </span>
                    <span className="flex items-center gap-2"><NotificationBadge state={n.state} /><RetryButton notification={n} onDone={messages.reload} /></span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-muted">No WhatsApp messages for this booking yet.</p>}
          </Card>
          <Card>
            <h3 className="text-xl">History</h3>
            <ol className="mt-3 space-y-3 text-sm">
              {[...b.statusHistory].reverse().map((h, i) => (
                <li key={i}><span className="font-medium">{BOOKING_STATUS_LABEL[h.status] ?? h.status}</span>{h.note && <span className="text-muted"> · {h.note}</span>}<span className="block text-xs text-muted">{formatDateTime(h.at)}</span></li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm === 'confirmed' ? 'Confirm this booking?' : 'Reject this booking?'}
        description={confirm === 'confirmed' ? 'Stock for every item is deducted now, in one safe step. If any item is short, nothing changes.' : 'The customer will see the booking as rejected. No stock is changed.'}
        confirmLabel={confirm === 'confirmed' ? 'Confirm booking' : 'Reject booking'}
        tone={confirm === 'confirmed' ? 'primary' : 'danger'}
        busy={Boolean(busy)}
        onConfirm={() => change(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
