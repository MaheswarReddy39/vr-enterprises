import { useId } from 'react';
import { cn } from '../../lib/cn.js';

export function Input({ label, hint, error, className, id, ...props }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-11 rounded-lg border bg-white px-3.5 text-sm text-ink placeholder:text-muted/70 transition-all duration-200 focus:shadow-glow focus:outline-none',
          error ? 'border-danger' : 'border-line hover:border-ink/40 focus:border-brand-500',
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
