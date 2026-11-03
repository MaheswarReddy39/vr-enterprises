import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as bookingsApi from '../../api/bookings.js';
import { KIND_LABEL, NotificationBadge } from '../../components/store/NotificationState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../../components/ui/States.jsx';
import { Table, Td, Th } from '../../components/ui/Table.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDateTime } from '../../lib/format.js';
import { BOOKING_STATUS_LABEL } from '../../lib/bookings.js';

/** Retry button shared by this page and the booking detail page. Only failed or not-yet-sent messages can be retried. */
export function RetryButton({ notification, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!['failed', 'skipped'].includes(notification.state)) return null;
  const run = async () => {
    setBusy(true);
    try {
      const { notification: result } = await bookingsApi.retryNotification(notification.id);
      if (result.state === 'sent') toast.success('WhatsApp message sent.');
      else toast.error(result.lastError || 'The message could not be sent.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      onDone?.();
    }
  };
  return <Button size="sm" variant="secondary" onClick={run} disabled={busy}>{busy && <Spinner size={14} />} Retry</Button>;
}

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page')) || 1;
  const state = params.get('state') ?? '';
  const setFilter = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries({ page: 1, ...patch })) {
      if (!v || (k === 'page' && v === 1)) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  const { data, loading, error, reload } = useAsync((signal) => bookingsApi.listNotifications({ state, page, limit: 20 }, signal), [state, page]);
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="WhatsApp notifications" description="Every WhatsApp message the website tried to send. A failed message never affects the booking; retry it here." />
      {data && !data.whatsapp.configured && (
        <p role="status" className="mb-4 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-sm">
          WhatsApp is not set up on the server yet, so no message is sent. Messages are saved as &ldquo;not sent&rdquo; and can be retried after you add the Meta credentials (see the README).
        </p>
      )}
      <Card className="p-0 sm:p-0">
        <div className="border-b border-line p-4 sm:max-w-xs">
          <Select label="Show" value={state} onChange={(e) => setFilter({ state: e.target.value })}>
            <option value="">All messages</option>
            <option value="failed">Failed</option>
            <option value="skipped">Not sent (WhatsApp not set up)</option>
            <option value="sent">Sent</option>
          </Select>
        </div>
        {loading && !data ? <LoadingState label="Loading..." /> : error ? <ErrorState message={error.message} onRetry={reload} /> : items.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No messages" description="Messages appear here when customers book and when you change a booking's status." />
        ) : (
          <>
            <Table caption="WhatsApp notifications">
              <thead><tr><Th>Booking</Th><Th className="hidden md:table-cell">Message</Th><Th>Result</Th><Th className="hidden sm:table-cell">To</Th><Th className="text-right">Action</Th></tr></thead>
              <tbody>
                {items.map((n) => (
                  <tr key={n.id}>
                    <Td>
                      <Link to={`/admin/bookings/${n.bookingRef}`} className="font-medium text-brand-900 hover:underline">{n.bookingId}</Link>
                      <p className="text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                    </Td>
                    <Td className="hidden md:table-cell">{KIND_LABEL[n.kind]}{n.status && <span className="text-muted"> · {BOOKING_STATUS_LABEL[n.status] ?? n.status}</span>}</Td>
                    <Td>
                      <NotificationBadge state={n.state} />
                      {n.lastError && <p className="mt-1 max-w-xs text-xs text-muted">{n.lastError}</p>}
                    </Td>
                    <Td className="hidden whitespace-nowrap sm:table-cell">{n.to || '-'}</Td>
                    <Td className="text-right"><RetryButton notification={n} onDone={reload} /></Td>
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
