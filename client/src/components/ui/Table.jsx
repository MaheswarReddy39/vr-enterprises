import { cn } from '../../lib/cn.js';

/** Horizontally scrollable on small screens so wide tables never break the page layout. */
export function Table({ children, caption, className }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full min-w-[34rem] border-collapse text-left text-sm', className)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export const Th = ({ className, ...props }) => (
  <th
    scope="col"
    className={cn('whitespace-nowrap border-b border-ink/15 px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted', className)}
    {...props}
  />
);

export const Td = ({ className, ...props }) => <td className={cn('border-b border-line/70 px-4 py-3 align-middle', className)} {...props} />;
