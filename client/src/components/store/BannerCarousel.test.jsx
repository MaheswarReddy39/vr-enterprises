import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateBanner } from '../../admin/pages/BannersPage.jsx';
import App from '../../app/App.jsx';
import { json, mockApi } from '../../test/storeFixtures.js';
import { BannerCarousel } from './BannerCarousel.jsx';

const image = { url: '/api/v1/media/b1', thumbUrl: '/api/v1/media/t1', width: 1600, height: 700 };
const banners = [
  { id: 'b1', title: 'Festive Offer', subtitle: 'Save on selected purifiers', ctaLabel: 'Shop now', linkUrl: '/shop?category=water', image },
  { id: 'b2', title: 'Partner Promo', subtitle: '', ctaLabel: 'Visit', linkUrl: 'https://example.com/promo', image },
  { id: 'b3', title: 'No Link Banner', subtitle: '', ctaLabel: '', linkUrl: '', image },
];

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('BannerCarousel', () => {
  it('renders nothing when there are no banners', () => {
    const { container } = render(<BannerCarousel banners={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(render(<BannerCarousel />).container).toBeEmptyDOMElement();
  });

  it('is an accessible carousel showing one slide at a time with manual controls only', async () => {
    render(<MemoryRouter><BannerCarousel banners={banners} /></MemoryRouter>);
    const region = screen.getByRole('region', { name: 'Promotions' });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    expect(screen.getByRole('heading', { name: 'Festive Offer' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Partner Promo' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next promotion' }));
    expect(screen.getByRole('heading', { name: 'Partner Promo' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Previous promotion' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous promotion' }));
    expect(screen.getByRole('heading', { name: 'No Link Banner' })).toBeVisible(); // wraps around
    await userEvent.click(screen.getByRole('button', { name: /Show promotion 2/ }));
    expect(screen.getByRole('heading', { name: 'Partner Promo' })).toBeVisible();
  });

  it('uses client-side links for site paths and safe external links for https URLs', async () => {
    render(<MemoryRouter><BannerCarousel banners={banners} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Shop now/ })).toHaveAttribute('href', '/shop?category=water');
    await userEvent.click(screen.getByRole('button', { name: 'Next promotion' }));
    const external = screen.getByRole('link', { name: /Visit/ });
    expect(external).toHaveAttribute('href', 'https://example.com/promo');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    expect(external).toHaveAttribute('target', '_blank');
    await userEvent.click(screen.getByRole('button', { name: 'Next promotion' }));
    expect(within(screen.getByRole('region')).queryByRole('link', { name: /Learn more/ })).not.toBeInTheDocument();
  });
});

describe('home page banners', () => {
  const stubs = {
    'GET /store/products': () => json(200, { success: true, items: [], pagination: { page: 1, limit: 4, total: 0, totalPages: 1 } }),
    'GET /store/categories': () => json(200, { success: true, items: [] }),
  };

  it('shows banners from the API above the hero', async () => {
    mockApi({ ...stubs, 'GET /store/banners': () => json(200, { success: true, items: banners }) });
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Festive Offer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('still renders the page when banners fail to load', async () => {
    mockApi({ ...stubs, 'GET /store/banners': () => json(500, { message: 'x' }) });
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Promotions' })).not.toBeInTheDocument();
  });
});

describe('validateBanner', () => {
  const ok = { title: 'Festive', subtitle: '', ctaLabel: '', linkUrl: '', isActive: true, startsAt: '', endsAt: '' };
  it('accepts a minimal banner and safe links', () => {
    expect(validateBanner(ok)).toEqual({});
    expect(validateBanner({ ...ok, linkUrl: '/shop?x=1' })).toEqual({});
    expect(validateBanner({ ...ok, linkUrl: 'https://example.com/a' })).toEqual({});
  });
  it('rejects dangerous or malformed links, short titles and reversed dates', () => {
    for (const linkUrl of ['javascript:alert(1)', '//evil.test', 'http://insecure.test', 'shop']) expect(validateBanner({ ...ok, linkUrl }).linkUrl).toBeTruthy();
    expect(validateBanner({ ...ok, title: 'x' }).title).toBeTruthy();
    expect(validateBanner({ ...ok, startsAt: '2030-02-01T10:00', endsAt: '2030-01-01T10:00' }).endsAt).toBeTruthy();
  });
});
