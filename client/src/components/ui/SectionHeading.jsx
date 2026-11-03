import { cn } from '../../lib/cn.js';

export function SectionHeading({ eyebrow, title, description, className }) {
  return (
    <header className={cn('max-w-2xl', className)}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">{eyebrow}</p>
      )}
      <h2 className="text-3xl sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted">{description}</p>}
    </header>
  );
}
