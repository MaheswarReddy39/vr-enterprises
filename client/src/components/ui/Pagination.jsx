import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../lib/format.js';
import { Button } from './Button.jsx';

export function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, limit, total, totalPages } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <p className="text-sm text-muted">
        Showing {formatNumber(from)}-{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} /> Prev
        </Button>
        <span className="min-w-20 text-center text-sm text-muted" aria-current="page">
          Page {page} of {totalPages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
}
