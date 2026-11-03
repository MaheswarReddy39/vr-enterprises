import { cn } from '../../lib/cn.js';

const base =
  'group inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-tight transition-all duration-300 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

const variants = {
  primary: 'bg-ink text-white hover:bg-brand-600',
  secondary: 'border border-ink/20 bg-transparent text-ink hover:border-ink hover:bg-white',
  accent: 'bg-accent-500 text-white hover:bg-accent-600',
  ghost: 'text-ink hover:bg-ink/5',
  onDark: 'border border-white/30 text-white hover:border-white hover:bg-white hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-90',
};

const sizes = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
};

export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  className,
  type,
  ...props
}) {
  return (
    <Component
      type={Component === 'button' ? (type ?? 'button') : type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
