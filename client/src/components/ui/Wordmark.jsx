import { mediaUrl } from '../../api/client.js';
import { useBusiness } from '../../features/business/useBusiness.js';
import { cn } from '../../lib/cn.js';

/** The uploaded logo (Admin > Store settings) when there is one, otherwise the text wordmark. */
export function Wordmark({ className, inverted = false }) {
  const { logo, name } = useBusiness();
  if (logo?.url) {
    return (
      <img
        src={mediaUrl(logo.url)}
        alt={name}
        className={cn('h-9 w-auto max-w-[11rem] object-contain', inverted && 'rounded bg-ivory p-1', className)}
      />
    );
  }
  // Default brand logo (public/brand). The light version is for dark backgrounds.
  return <img src={inverted ? '/brand/logo-light.svg' : '/brand/logo.svg'} alt={name} width="146" height="40" className={cn('h-9 w-auto max-w-[12rem]', className)} />;
}
