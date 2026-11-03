import { useId } from 'react';
import { cn } from '../../lib/cn.js';

export const controlClasses = (error) =>
  cn(
    'rounded-lg border bg-white px-3.5 text-sm text-ink placeholder:text-muted/70 transition-all duration-200 focus:shadow-glow focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
    error ? 'border-danger' : 'border-line hover:border-ink/40 focus:border-brand-500',
  );

/**
 * Label + control + hint/error wiring shared by Select and Textarea. Accessible: the label is bound with
 * htmlFor, the error is announced through aria-describedby and aria-invalid.
 */
export function Field({ label, hint, error, required, className, id, children }) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-ink">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          )}
        </label>
      )}
      {children({ id: fieldId, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
