import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { mediaUrl } from '../../api/client.js';
import { cn } from '../../lib/cn.js';

/**
 * <img> for API-served images. Resolves site-relative media paths against the API origin and, if the
 * file is missing or fails to load, shows a neutral placeholder instead of a broken-image icon.
 */
export function SafeImage({ src, alt = '', className, ...props }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span role={alt ? 'img' : undefined} aria-label={alt ? `${alt} (image unavailable)` : undefined} className={cn('grid place-items-center bg-paper text-muted', className)}>
        <ImageOff size={18} aria-hidden="true" />
      </span>
    );
  }
  // blob: and data: URLs (local previews) pass through untouched.
  return <img src={mediaUrl(src)} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} {...props} />;
}
