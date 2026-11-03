import { Link } from 'react-router-dom';
import { Seo } from '../components/Seo.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Container } from '../components/ui/Container.jsx';

export default function NotFoundPage() {
  return (
    <Container className="py-24 text-center">
      <Seo title="Page not found" noindex />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">Error 404</p>
      <h1 className="mt-3 text-4xl sm:text-5xl">Page not found</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">The page you are looking for does not exist or has moved.</p>
      <Button as={Link} to="/" className="mt-8">
        Back to home
      </Button>
    </Container>
  );
}
