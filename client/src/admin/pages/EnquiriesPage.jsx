import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { api } from './enquiriesApi.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDateTime } from '../../lib/format.js';

const tone = { new: 'accent', read: 'neutral', resolved: 'success' };

export default function EnquiriesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync((signal) => api.list({ page, limit: 15, status }, signal), [page, status]);
  const items = data?.items ?? [];

  const changeStatus = async (enquiry, next) => {
    try {
      await api.setStatus(enquiry._id, next);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.remove(toDelete._id);
      toast.success('Enquiry deleted.');
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Enquiries" description="Messages sent from the storefront contact form and product pages." />
      <Card className="p-0 sm:p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4">
          <Select label="Show" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} fieldClassName="w-48">
            <option value="">All enquiries</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="resolved">Resolved</option>
          </Select>
          {data && <p className="text-sm text-muted">{data.unread} new</p>}
        </div>

        {loading && !data ? <LoadingState label="Loading enquiries..." /> : error ? <ErrorState message={error.message} onRetry={reload} /> : items.length === 0 ? (
          <EmptyState icon={Inbox} title="No enquiries yet" description="Messages from your website visitors will appear here." />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {items.map((e) => (
                <li key={e._id} className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{e.name} <Badge tone={tone[e.status]} className="ml-1 capitalize">{e.status}</Badge></p>
                      <p className="text-sm text-muted">
                        <a className="underline" href={`mailto:${e.email}`}>{e.email}</a>
                        {e.phone && <> · {e.phone}</>}
                        {' · '}{formatDateTime(e.createdAt)}
                      </p>
                      {e.productName && <p className="mt-1 text-sm">About: <strong>{e.productName}</strong></p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select aria-label={`Status for enquiry from ${e.name}`} value={e.status} onChange={(ev) => changeStatus(e, ev.target.value)} className="h-9 text-sm">
                        <option value="new">New</option>
                        <option value="read">Read</option>
                        <option value="resolved">Resolved</option>
                      </Select>
                      {user.role === 'admin' && <Button variant="ghost" size="sm" className="text-danger" onClick={() => setToDelete(e)}>Delete</Button>}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{e.message}</p>
                </li>
              ))}
            </ul>
            <Pagination pagination={data.pagination} onChange={setPage} />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        busy={busy}
        title="Delete this enquiry?"
        description={`The enquiry from ${toDelete?.name ?? ''} will be permanently deleted.`}
        confirmLabel="Delete enquiry"
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
