import { cn } from '../../lib/cn.js';

export function Container({ as: Component = 'div', className, ...props }) {
  return <Component className={cn('mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8', className)} {...props} />;
}
