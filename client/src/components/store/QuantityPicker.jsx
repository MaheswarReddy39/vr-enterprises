import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/** −/+ quantity control kept within 1..max. Used on product pages and in the cart. */
export function QuantityPicker({ value, max, onChange, disabled, label = 'Quantity', compact = false }) {
  const clamp = (n) => Math.min(Math.max(Number.isFinite(n) ? n : 1, 1), Math.max(max, 1));
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center rounded-lg border border-line bg-ivory', compact ? 'h-10' : 'h-12', disabled && 'opacity-50')}>
      <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={disabled || value <= 1} onClick={() => onChange(clamp(value - 1))} className={cn('grid h-full place-items-center text-muted hover:text-ink disabled:opacity-40', compact ? 'w-9' : 'w-11')}>
        <Minus size={16} />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(clamp(parseInt(e.target.value.replace(/\D/g, ''), 10)))}
        className={cn('h-full border-x border-line bg-transparent text-center text-sm', compact ? 'w-10' : 'w-12')}
      />
      <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))} className={cn('grid h-full place-items-center text-muted hover:text-ink disabled:opacity-40', compact ? 'w-9' : 'w-11')}>
        <Plus size={16} />
      </button>
    </div>
  );
}
