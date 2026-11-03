import { cn } from '../../lib/cn.js';

const tones = {
  neutral: 'bg-ink/5 text-ink',
  brand: 'bg-brand-50 text-brand-700',
  accent: 'bg-accent-50 text-accent-600',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export function Badge({ tone = 'neutral', className, ...props }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide', tones[tone], className)}
      {...props}
    />
  );
}
