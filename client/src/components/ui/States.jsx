import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Button } from './Button.jsx';

export function Spinner({ className, size = 18 }) {
  return <Loader2 size={size} aria-hidden="true" className={cn('animate-spin', className)} />;
}

export function LoadingState({ label = 'Loading...', className }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-3 p-10 text-sm text-muted', className)}>
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h3 className="text-lg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle size={22} aria-hidden="true" />
      </span>
      <h3 className="text-lg">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
