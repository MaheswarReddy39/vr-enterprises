import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '../../components/ui/States.jsx';
import { useAuth } from './AuthContext.jsx';

/**
 * UI guard for the admin area. This is a convenience only: every admin API endpoint independently
 * enforces authentication and roles on the server, so a customer who reaches this page sees nothing useful.
 */
export function RequireAdmin() {
  const { status, expired, isAdmin } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingState label="Checking your session..." className="min-h-dvh" />;
  if (status === 'unauthenticated' || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search, expired, notAdmin: status === 'authenticated' }} />;
  }
  return <Outlet />;
}

/** Guard for customer-only pages such as /account. */
export function RequireSignedIn() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState label="Checking your session..." className="min-h-[50vh]" />;
  if (status === 'unauthenticated') return <Navigate to="/account/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
