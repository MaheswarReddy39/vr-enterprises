import { useBusiness } from '../features/business/useBusiness.js';

/**
 * Per-page <title> and metadata. React 19 hoists these tags into <head>, so no extra library is needed.
 * While `business.isPreview` is true every page is marked noindex so a demo/preview site is not indexed.
 *
 * Note: this is a client-rendered app. Search engines that run JavaScript (Google, Bing) see these tags;
 * crawlers that do not would need server-side rendering, which is not part of this milestone.
 */
export function Seo({ title, description, image, noindex = false }) {
  const business = useBusiness();
  const fullTitle = title ? `${title} | ${business.name}` : `${business.name} | ${business.category}`;
  const hide = noindex || business.isPreview;
  return (
    <>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={business.name} />
      {image && <meta property="og:image" content={image} />}
      <meta name="robots" content={hide ? 'noindex, nofollow' : 'index, follow'} />
    </>
  );
}
