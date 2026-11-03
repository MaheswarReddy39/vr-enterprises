import { useId } from 'react';
import { cn } from '../../lib/cn.js';

export function Switch({ checked, onChange, label, description, disabled, className }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-brand-500' : 'bg-ink/20',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
      <div>
        <label id={`${id}-label`} htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
    </div>
  );
}
