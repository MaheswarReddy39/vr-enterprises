import { CheckCircle2, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as bookingsApi from '../api/bookings.js';
import { Seo } from '../components/Seo.jsx';
import { StatusBadge } from '../components/store/BookingStatus.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Container } from '../components/ui/Container.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { SafeImage } from '../components/ui/SafeImage.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { cn } from '../lib/cn.js';
import { formatDateTime, formatPrice, formatTotal } from '../lib/format.js';
import { BOOKING_STATUS_LABEL, PROGRESS_STEPS, formatAddress } from '../lib/bookings.js';

export function BookingsPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync((signal) => bookingsApi.listMyBookings({ page, limit: 10 }, signal), [page]);

  return (
    <>
      <Seo title="My bookings" noindex />
      <section className="border-b border-line">
        <Container className="py-10"><h1 className="text-4xl">My bookings</h1></Container>
      </section>
      <Container className="py-10">
        {loading && !data ? <LoadingState /> : error ? <ErrorState message={error.message} onRetry={reload} /> : data.items.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No bookings yet" description="When you book a product it appears here with its status." action={<Button as={Link} to="/shop">Browse products</Button>} />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {data.items.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/account/bookings/${b.id}`} className="font-medium text-brand-900 hover:underline">{b.bookingId}</Link>
                    <p className="truncate text-sm text-muted">{formatDateTime(b.createdAt)} · {b.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}</p>
                  </div>
                  <StatusBadge status={b.status} />
                  <p className="w-full text-right font-medium sm:w-auto">{formatTotal(b.total, b.items.some((i) => !i.price))}</p>
                </li>
              ))}
            </ul>
            <Pagination pagination={data.pagination} onChange={setPage} />
          </>
        )}
      </Container>
    </>
  );
}

function Progress({ status }) {
  if (status === 'rejected') return <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="status">This booking was rejected.</p>;
  const current = PROGRESS_STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-2 text-center text-xs" aria-label="Booking progress">
      {PROGRESS_STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className={cn('rounded-lg border px-1 py-2', i <= current ? 'border-brand-700 bg-brand-50 font-medium text-brand-900' : 'border-line text-muted')}>
          {BOOKING_STATUS_LABEL[s]}
        </li>
      ))}
    </ol>
  );
}

export function BookingDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync((signal) => bookingsApi.getMyBooking(id, signal), [id]);
  const b = data?.booking;

  return (
    <>
      <Seo title="Booking" noindex />
      <Container className="py-10">
        <Link to="/account/bookings" className="text-sm text-brand-800 underline-offset-4 hover:underline">All bookings</Link>
        {loading && !data ? <LoadingState /> : error ? <ErrorState message={error.status === 404 ? 'We could not find that booking.' : error.message} onRetry={reload} /> : (
          <div className="mt-4 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl sm:text-4xl">{b.bookingId}</h1>
              <StatusBadge status={b.status} />
            </div>
            <p className="text-sm text-muted">Booked on {formatDateTime(b.createdAt)}. No payment is taken on this site.</p>
            <Progress status={b.status} />

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-line/80 bg-ivory shadow-soft p-6 text-sm">
                <h2 className="text-xl">Items</h2>
                <ul className="mt-3 divide-y divide-line">
                  {b.items.map((i) => (
                    <li key={i.productId} className="flex gap-3 py-3">
                      <SafeImage src={i.imageThumbUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1"><p className="font-medium">{i.name}</p><p className="text-muted">{formatPrice(i.price)} × {i.quantity}</p></div>
                      <p className="font-medium">{formatPrice(i.lineTotal)}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between border-t border-line pt-3 text-base"><span className="font-medium">Total (displayed prices)</span><span className="font-display text-xl">{formatTotal(b.total, b.items.some((i) => !i.price))}</span></p>
              </div>
              <div className="space-y-6">
                <div className="rounded-xl border border-line/80 bg-ivory shadow-soft p-6 text-sm">
                  <h2 className="text-xl">Delivery</h2>
                  <p className="mt-3 leading-relaxed">{formatAddress({ ...b.deliveryAddress, name: b.customer.name, phone: b.customer.mobile }).map((l, i) => <span key={i} className={i === 0 ? 'block font-medium' : 'block text-muted'}>{l}</span>)}</p>
                </div>
                <div className="rounded-xl border border-line/80 bg-ivory shadow-soft p-6 text-sm">
                  <h2 className="text-xl">History</h2>
                  <ol className="mt-3 space-y-3">
                    {[...b.statusHistory].reverse().map((h, i) => (
                      <li key={i} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" /><span><span className="font-medium">{BOOKING_STATUS_LABEL[h.status] ?? h.status}</span>{h.note && <span className="text-muted"> · {h.note}</span>}<span className="block text-xs text-muted">{formatDateTime(h.at)}</span></span></li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
