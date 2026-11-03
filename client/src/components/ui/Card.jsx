import { cn } from '../../lib/cn.js';

export function Card({ className, ...props }) {
  return <div className={cn('rounded-xl border border-line bg-ivory p-5 sm:p-6', className)} {...props} />;
}
