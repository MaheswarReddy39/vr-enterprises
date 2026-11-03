import { useHealth } from '../hooks/useHealth.js';
import { Badge } from './ui/Badge.jsx';
import { Card } from './ui/Card.jsx';

const toneFor = (value) =>
  ['connected', 'configured', 'supported'].includes(value) ? 'success' : ['unknown', 'not_configured'].includes(value) ? 'warning' : 'danger';

function Row({ label, value }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <Badge tone={toneFor(value)}>{value.replace('_', ' ')}</Badge>
    </li>
  );
}

/** Developer-facing connectivity check shown only in development builds. */
export function HealthStatus() {
  const { status, data, error } = useHealth();

  return (
    <Card aria-live="polite">
      <h3 className="text-xl">System status</h3>
      {status === 'loading' && <p className="mt-3 text-sm text-muted">Checking the API...</p>}
      {status === 'error' && (
        <p role="alert" className="mt-3 text-sm text-danger">
          API unreachable: {error.message}
        </p>
      )}
      {status === 'success' && (
        <ul className="mt-2 divide-y divide-line">
          <Row label="API" value={data.status === 'ok' ? 'connected' : data.status} />
          <Row label="Database" value={data.services.database} />
          <Row label="Transactions" value={data.services.transactions} />
          <Row label="Image storage (GridFS)" value={data.services.imageStorage === 'gridfs' ? 'connected' : data.services.imageStorage} />
        </ul>
      )}
    </Card>
  );
}
