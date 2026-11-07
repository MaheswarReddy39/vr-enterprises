import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Seo } from './Seo.jsx';

vi.mock('../features/business/useBusiness.js', () => ({
  useBusiness: () => ({ name: 'Test Water', category: 'Purifiers', isPreview: false }),
}));

describe('Seo', () => {
  it('updates page, sharing and canonical metadata', () => {
    render(<Seo title="Shop" description="Browse purifiers." image="/hero.jpg" />);

    expect(document.title).toBe('Shop | Test Water');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', 'Browse purifiers.');
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'Shop | Test Water');
    expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', window.location.origin + window.location.pathname);
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  });

  it('keeps private pages out of search results', () => {
    render(<Seo title="Account" noindex />);

    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });
});
