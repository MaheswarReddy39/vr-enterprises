import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';

const supported = () => typeof window !== 'undefined' && 'IntersectionObserver' in window;
const VARIANT = { up: 'reveal', image: 'reveal-image', lines: 'reveal-lines' };

/**
 * Scroll reveal, once per element, using only opacity/transform/clip-path (cheap for the browser):
 *  - "up"    fades and lifts the content into place;
 *  - "image" uncovers a picture from the bottom while it settles from a slight zoom;
 *  - "lines" slides headline lines (<span class="line"><span>...</span></span>) up out of a mask.
 * Everything is simply visible when JavaScript, IntersectionObserver or motion is unavailable (see main.jsx and index.css).
 */
export function Reveal({ as: Tag = 'div', variant = 'up', delay = 0, className, children, ...props }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(!supported());

  useEffect(() => {
    if (visible || !ref.current) return undefined;
    const node = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag ref={ref} className={cn(VARIANT[variant] ?? 'reveal', visible && 'is-visible', className)} style={delay ? { '--reveal-delay': `${delay}ms` } : undefined} {...props}>
      {children}
    </Tag>
  );
}
