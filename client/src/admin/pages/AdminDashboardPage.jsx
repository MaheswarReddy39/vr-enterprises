import { BellRing } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as adminApi from '../../api/admin.js';
import { StatusBadge } from '../../components/store/BookingStatus.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDateTime, formatNumber, formatTotal } from '../../lib/format.js';

const cards = (s, p) => [
  { label: 'Total bookings', value: s.bookings.total, to: '/admin/bookings' },
  { label: 'Pending bookings', value: s.bookings.pending, to: '/admin/bookings?status=pending', warn: s.bookings.pending > 0 },
  { label: 'Confirmed bookings', value: s.bookings.confirmed, to: '/admin/bookings?status=confirmed' },
  { label: 'Processing bookings', value: s.bookings.processing, to: '/admin/bookings?status=processing' },
  { label: 'Completed bookings', value: s.bookings.completed, to: '/admin/bookings?status=completed' },
  { label: 'Rejected bookings', value: s.bookings.rejected, to: '/admin/bookings?status=rejected' },
  { label: 'Customers', value: s.customers.total, to: '/admin/customers', hint: `${formatNumber(s.customers.active)} active` },
  { label: 'Published products', value: s.products.published, to: '/admin/products?status=published' },
  { label: 'Low / out of stock', value: `${formatNumber(p.inventory.low)} / ${formatNumber(p.inventory.out)}`, to: '/admin/inventory?stock=low', warn: p.inventory.low + p.inventory.out > 0 },
];

const summary = (b) => b.items.map((i) => `${i.name} × ${i.quantity}`).join(', ');

export default function AdminDashboardPage() {
  const { data, loading, error, reload } = useAsync(async (signal) => {
    const [stats, products] = await Promise.all([adminApi.getStats(signal), adminApi.getSummary(signal)]);
    return { stats, products };
  }, []);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const { stats, products } = data;
  const unread = stats.bookings.unread;

  return (
    <div className="space-y-6">
      {unread > 0 && (
        <section aria-label="New bookings" role="status" className="rounded-lg border border-accent-300 bg-accent-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl"><BellRing size={20} aria-hidden="true" /> New booking{unread === 1 ? '' : 's'}: {formatNumber(unread)} unread</h2>
            <Link to="/admin/bookings?unread=true" className="text-sm font-medium text-brand-800 underline-offset-4 hover:underline">View unread</Link>
          </div>
          <ul className="mt-3 divide-y divide-accent-200 text-sm">
            {stats.newBookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <Link to={`/admin/bookings/${b.id}`} className="font-medium text-brand-900 hover:underline">{b.bookingId}</Link>
                <span className="min-w-0 flex-1 truncate text-muted">{b.customer?.name} · {summary(b)}</span>
                <span className="text-xs text-muted">{formatDateTime(b.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.notifications?.failed > 0 && (
        <p role="status" className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm">
          {formatNumber(stats.notifications.failed)} WhatsApp message{stats.notifications.failed === 1 ? '' : 's'} could not be sent.{' '}
          <Link to="/admin/notifications?state=failed" className="font-medium underline underline-offset-4">Review and retry</Link>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards(stats, products).map(({ label, value, to, warn, hint }) => (
          <Link key={label} to={to} className="group block rounded-lg focus-visible:outline-offset-4">
            <Card className="hover-lift relative h-full overflow-hidden">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-500" />
              <p className="text-sm font-medium text-muted">{label}</p>
              <p className={`mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl ${warn ? 'text-warning' : 'text-brand-800'}`}>{typeof value === 'number' ? formatNumber(value) : value}</p>
              {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
            </Card>
          </Link>
        ))}
      </div>

      <Card className="p-0 sm:p-0">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-xl">Recent bookings</h2>
          <Link to="/admin/bookings" className="text-sm text-brand-800 underline-offset-4 hover:underline">View all</Link>
        </div>
        {stats.recentBookings.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No bookings yet. They appear here as soon as customers book products.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {stats.recentBookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/bookings/${b.id}`} className="font-medium text-brand-900 hover:underline">{b.bookingId}</Link>
                  <p className="truncate text-xs text-muted">{b.customer?.name} · {formatDateTime(b.createdAt)}</p>
                </div>
                <StatusBadge status={b.status} />
                <span className="w-full text-right font-medium sm:w-auto">{formatTotal(b.total, b.items.some((i) => !i.price))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
