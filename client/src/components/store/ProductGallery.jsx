import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { Badge } from '../ui/Badge.jsx';
import { SafeImage } from '../ui/SafeImage.jsx';

/** Primary image large, secondary images as thumbnails. Thumbnails are real buttons (keyboard + screen-reader friendly). */
export function ProductGallery({ images, name, isDemo }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [images]);

  if (images.length === 0) {
    return (
      <div className="grid aspect-square place-items-center rounded-lg bg-ivory text-sm text-muted ring-1 ring-line">No image available</div>
    );
  }

  const current = images[Math.min(index, images.length - 1)];
  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
    else if (event.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
  };

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-sand">
        <SafeImage
          key={current.id}
          src={current.url}
          alt={current.alt || `${name}, image ${index + 1} of ${images.length}`}
          width={current.width}
          height={current.height}
          loading="eager"
          fetchPriority="high"
          className="size-full object-contain p-4 mix-blend-multiply"
        />
        {isDemo && <Badge className="absolute left-3 top-3">Demo placeholder image</Badge>}
      </div>

      {images.length > 1 && (
        <ul className="mt-4 grid grid-cols-5 gap-3" role="group" aria-label="Product images" onKeyDown={onKeyDown}>
          {images.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-pressed={i === index}
                className={cn(
                  'block aspect-square w-full overflow-hidden rounded-xl bg-sand ring-1 transition duration-300 hover:-translate-y-0.5',
                  i === index ? 'ring-2 ring-ink' : 'ring-line hover:ring-brand-300',
                )}
              >
                <SafeImage src={image.thumbUrl} alt="" className="size-full object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {isDemo && <p className="mt-3 text-xs text-muted">Demo product with placeholder imagery. Real product photographs will replace it.</p>}
    </div>
  );
}
