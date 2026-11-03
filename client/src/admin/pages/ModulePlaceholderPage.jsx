import { useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card } from '../../components/ui/Card.jsx';
import NotFoundPage from '../../pages/NotFoundPage.jsx';
import { adminNav } from '../nav.js';

export default function ModulePlaceholderPage() {
  const { module } = useParams();
  const item = adminNav.find((entry) => entry.to === `/admin/${module}`);
  if (!item?.milestone) return <NotFoundPage />;

  return (
    <Card className="max-w-2xl">
      <Badge tone="accent">Planned: milestone {item.milestone}</Badge>
      <h2 className="mt-4 text-2xl">{item.label}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">This module has not been built yet.</p>
    </Card>
  );
}
