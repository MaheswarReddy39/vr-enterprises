import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn.js';
import { useBusiness } from '../../features/business/useBusiness.js';
import { Container } from '../ui/Container.jsx';
import { Reveal } from '../ui/Reveal.jsx';
import { SafeImage } from '../ui/SafeImage.jsx';

const ctaClass = 'group mt-9 inline-flex h-13 w-fit items-center gap-2 rounded-lg bg-ink px-7 text-base font-semibold text-white transition-colors duration-300 hover:bg-brand-600';

/** Banner links are internal paths (client-side navigation) or https URLs (opened as a normal external link). */
function BannerLink({ banner }) {
  if (!banner.linkUrl) return null;
  const label = banner.ctaLabel || 'Learn more';
  const arrow = <ArrowRight size={18} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />;
  return banner.linkUrl.startsWith('/') ? (
    <Link to={banner.linkUrl} className={ctaClass}>{label}{arrow}<span className="sr-only">: {banner.title}</span></Link>
  ) : (
    <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className={ctaClass}>{label}{arrow}<span className="sr-only">: {banner.title} (opens in a new tab)</span></a>
  );
}

/**
 * Promotional banners managed in the admin dashboard, shown as the homepage's opening statement: a large headline on the
 * left, the artwork on the right. Manual controls only (no auto-advance), so nothing moves on its own.
 * Renders nothing when there are no active banners.
 */
export function BannerCarousel({ banners, asH1 = false }) {
  const business = useBusiness();
  const [index, setIndex] = useState(0);
  if (!banners?.length) return null;
  const Heading = asH1 ? 'h1' : 'h2';

  const count = banners.length;
  const current = Math.min(index, count - 1);
  const go = (n) => setIndex((n + count) % count);

  return (
    <section role="region" aria-roledescription="carousel" aria-label="Promotions" className="relative overflow-hidden border-b border-line bg-paper">
      <Container className="py-10 sm:py-16 lg:py-20">
        <div className="relative">
          {banners.map((b, i) => (
            <div key={b.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} hidden={i !== current} className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
              <div className="order-2 lg:order-1">
                <p className="eyebrow-line mb-6 text-xs font-bold uppercase tracking-[0.24em] text-accent-500">{business.name}</p>
                <Reveal variant="lines" key={`${b.id}-${current === i}`}>
                  <Heading aria-label={b.title} className="text-[2.9rem] leading-[0.98] sm:text-7xl lg:text-[5.4rem]">
                    {b.title.split(/(?<=\.)\s+/).map((part, n) => (
                      <span key={n} className="line" style={{ '--i': n }}><span>{part} </span></span>
                    ))}
                  </Heading>
                </Reveal>
                {b.subtitle && <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">{b.subtitle}</p>}
                <BannerLink banner={b} />
              </div>
              <Reveal variant="image" className="order-1 overflow-hidden rounded-xl lg:order-2">
                <div className="aspect-[16/11] bg-brand-50">
                  <SafeImage src={b.image.url} alt="" width={b.image.width} height={b.image.height} loading={i === 0 ? 'eager' : 'lazy'} className="size-full object-cover" />
                </div>
              </Reveal>
            </div>
          ))}

          {count > 1 && (
            <div className="mt-10 flex items-center justify-between">
              <div className="flex gap-2" role="group" aria-label="Choose a promotion">
                {banners.map((b, i) => (
                  <button key={b.id} type="button" aria-label={`Show promotion ${i + 1}: ${b.title}`} aria-current={i === current} onClick={() => setIndex(i)} className={cn('h-1.5 rounded-full transition-all duration-500', i === current ? 'w-10 bg-ink' : 'w-4 bg-ink/20 hover:bg-ink/40')} />
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" aria-label="Previous promotion" onClick={() => go(current - 1)} className="grid size-10 place-items-center rounded-full border border-ink/20 transition-colors hover:border-ink hover:bg-ink hover:text-white"><ChevronLeft size={18} /></button>
                <button type="button" aria-label="Next promotion" onClick={() => go(current + 1)} className="grid size-10 place-items-center rounded-full border border-ink/20 transition-colors hover:border-ink hover:bg-ink hover:text-white"><ChevronRight size={18} /></button>
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
