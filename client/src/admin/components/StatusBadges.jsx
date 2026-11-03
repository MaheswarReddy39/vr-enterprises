import { Badge } from '../../components/ui/Badge.jsx';

const productTone = { published: 'success', draft: 'neutral', archived: 'warning' };
const stockTone = { in: 'success', low: 'warning', out: 'danger' };
const stockLabel = { in: 'In stock', low: 'Low stock', out: 'Out of stock' };

export const ProductStatusBadge = ({ status }) => (
  <Badge tone={productTone[status] ?? 'neutral'} className="capitalize">
    {status}
  </Badge>
);

export const StockBadge = ({ status }) => <Badge tone={stockTone[status]}>{stockLabel[status]}</Badge>;

export const ActiveBadge = ({ active }) => <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>;
