import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../app/App.jsx';
import { categories, json, makeProduct, mockApi, page } from '../test/storeFixtures.js';
import { vi } from 'vitest';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const alpha = makeProduct();
const beta = makeProduct({ id: 'p2', slug: 'beta-purifier', name: 'Beta Purifier', price: 9000, mrp: null, discountPercent: null, isFeatured: true });
const demo = makeProduct({ id: 'p3', slug: 'demo-purifier', name: 'Demo Purifier (DEMO)', sku: 'DEMO-1', isDemo: true });
const soldOut = makeProduct({ id: 'p4', slug: 'sold-out', name: 'Sold Out Purifier', availability: 'out_of_stock', maxQuantity: 0 });

const catalogue = {
  'GET /store/categories': () => json(200, { success: true, items: categories }),
  'GET /store/products': () => json(200, page([alpha, beta, demo, soldOut])),
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('home page', () => {
  it('builds its sections from the API and shows no demo testimonials', async () => {
    mockApi({
      ...catalogue,
      'GET /store/products': (path) => json(200, page(path.includes('featured=true') ? [beta, demo] : [alpha])),
    });
    renderAt('/');

    expect(await screen.findByRole('heading', { level: 1, name: /right water purifier/i })).toBeInTheDocument();
    for (const heading of ['Featured purifiers', 'Shop by category', 'Why choose VR Water Solutions', 'Have a question? Send an enquiry.']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect((await screen.findAllByText('Beta Purifier')).length).toBeGreaterThan(0);
    expect(await screen.findByRole('link', { name: /Water\s*4 products/ })).toHaveAttribute('href', '/shop?category=water');
    expect(screen.queryByRole('heading', { name: 'What customers say' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Demo content/)).not.toBeInTheDocument();
    expect(document.title).toBe('VR Water Solutions | Water purifiers');
  });

  it('keeps the page usable and offers a retry when the API is down', async () => {
    mockApi({ 'GET /store/products': () => json(500, { message: 'boom' }), 'GET /store/categories': () => json(500, { message: 'boom' }) });
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
  });

  it('explains an empty featured list instead of showing a blank gap', async () => {
    mockApi({ ...catalogue, 'GET /store/products': () => json(200, page([])) });
    renderAt('/');
    expect(await screen.findByText(/Featured products will appear here/)).toBeInTheDocument();
  });
});

describe('shop page', () => {
  it('lists products with prices, discounts, availability and labels', async () => {
    mockApi(catalogue);
    renderAt('/shop');
    expect(await screen.findByRole('heading', { name: 'Alpha Purifier' })).toBeInTheDocument();
    const alphaCard = screen.getByRole('heading', { name: 'Alpha Purifier' }).closest('article');
    expect(within(alphaCard).getByText(/₹12,000/)).toBeInTheDocument();
    expect(within(alphaCard).getByText('20% off')).toBeInTheDocument();
    expect(within(alphaCard).getByText('In stock')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'Beta Purifier' }).closest('article')).getByText('Featured')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'Demo Purifier (DEMO)' }).closest('article')).getByText('Demo')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'Sold Out Purifier' }).closest('article')).getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByText('4 products')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Alpha Purifier/ })).toHaveAttribute('href', '/product/alpha-purifier');
  });

  it('sends search, sort, category and page to the API, and reads them from the URL', async () => {
    const calls = mockApi({ ...catalogue, 'GET /store/products': () => json(200, page([alpha, beta], { total: 30, totalPages: 3 })) });
    renderAt('/shop?q=alpha&category=water&sort=price_asc&page=2');
    await screen.findByRole('heading', { name: 'Alpha Purifier' });
    const productCall = calls.find((c) => c.path.startsWith('/store/products'));
    expect(Object.fromEntries(productCall.query)).toMatchObject({ q: 'alpha', category: 'water', sort: 'price_asc', page: '2', limit: '12' });
    expect(screen.getByLabelText('Sort by')).toHaveValue('price_asc');
    expect(screen.getByLabelText('Search products', { selector: '#shop-search' })).toHaveValue('alpha');
  });

  it('changes sorting, category and page through the controls', async () => {
    const calls = mockApi({ ...catalogue, 'GET /store/products': () => json(200, page([alpha, beta], { total: 30, totalPages: 3 })) });
    renderAt('/shop');
    await screen.findByRole('heading', { name: 'Alpha Purifier' });
    const lastQuery = () => Object.fromEntries(calls.filter((c) => c.path.startsWith('/store/products')).at(-1).query);

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'price_desc');
    await waitFor(() => expect(lastQuery().sort).toBe('price_desc'));

    await userEvent.click(await screen.findByRole('button', { name: /Commercial/ }));
    await waitFor(() => expect(lastQuery().category).toBe('commercial'));
    expect(lastQuery().page).toBe('1'); // a new filter always returns to the first page

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(lastQuery().page).toBe('2'));
  });

  it('searches after typing, using the debounced value', async () => {
    const calls = mockApi(catalogue);
    renderAt('/shop');
    await screen.findByRole('heading', { name: 'Alpha Purifier' });
    await userEvent.type(screen.getByLabelText('Search products', { selector: '#shop-search' }), 'beta');
    await waitFor(() => expect(calls.some((c) => c.query.get('q') === 'beta')).toBe(true), { timeout: 3000 });
    expect(calls.filter((c) => c.path.startsWith('/store/products') && c.query.get('q')).length).toBe(1);
  });

  it('shows an empty state with a way to clear filters', async () => {
    mockApi({ ...catalogue, 'GET /store/products': () => json(200, page([])) });
    renderAt('/shop?q=nothing');
    expect(await screen.findByText('No products match your search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('shows a retryable error when the products cannot be loaded', async () => {
    mockApi({ ...catalogue, 'GET /store/products': () => json(500, { message: 'down' }) });
    renderAt('/shop');
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the products/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('never sends credentials to the public endpoints', async () => {
    const calls = mockApi(catalogue);
    renderAt('/shop');
    await screen.findByRole('heading', { name: 'Alpha Purifier' });
    expect(calls.every((c) => !c.headers?.Authorization)).toBe(true);
  });
});

describe('product page', () => {
  const related = [beta];
  const routes = (product) => ({
    'GET /store/products/alpha-purifier': () => json(200, { success: true, product }),
    'GET /store/products/alpha-purifier/related': () => json(200, { success: true, items: related }),
  });

  it('shows the product, its dynamic specifications, features and related products', async () => {
    mockApi(routes(alpha));
    renderAt('/product/alpha-purifier');
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Purifier' })).toBeInTheDocument();
    expect(screen.getByText('Capacity')).toBeInTheDocument();
    expect(screen.getByText('10 litres')).toBeInTheDocument();
    expect(screen.getByText('Feature one')).toBeInTheDocument();
    expect(screen.getByText('First paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'You may also like' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Beta Purifier' })).toBeInTheDocument();
    expect(document.title).toBe('Alpha Purifier | VR Water Solutions');
  });

  it('switches gallery images with accessible thumbnail buttons', async () => {
    mockApi(routes(alpha));
    renderAt('/product/alpha-purifier');
    await screen.findByRole('heading', { level: 1 });
    const second = screen.getByRole('button', { name: 'Show image 2 of 2' });
    expect(second).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByAltText(/image 2 of 2/)).toHaveAttribute('src', '/api/v1/media/a2');
  });

  it('keeps quantity within 1 and the available maximum', async () => {
    mockApi(routes(makeProduct({ maxQuantity: 3 })));
    renderAt('/product/alpha-purifier');
    await screen.findByRole('heading', { level: 1 });
    const input = screen.getByRole('textbox', { name: 'Quantity' });
    const plus = screen.getByRole('button', { name: 'Increase quantity' });
    const minus = screen.getByRole('button', { name: 'Decrease quantity' });
    expect(minus).toBeDisabled();
    await userEvent.click(plus);
    await userEvent.click(plus);
    await userEvent.click(plus);
    expect(input).toHaveValue('3');
    expect(plus).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, '99');
    expect(input).toHaveValue('3');
    expect(screen.getByText('Up to 3 available per order.')).toBeInTheDocument();
  });

  it('adds to the cart for real and links to it, without asking the shopper to sign in', async () => {
    const line = { productId: 'p1', slug: 'alpha-purifier', name: 'Alpha Purifier', sku: 'ALP-001', price: 12000, mrp: null, isDemo: false, image: null, quantity: 2, maxQuantity: 10, availability: 'in_stock', available: true, issue: null, lineTotal: 24000 };
    const calls = mockApi({
      ...routes(alpha),
      'POST /store/cart/quote': () => json(200, { success: true, cart: { lines: [line], itemCount: 2, subtotal: 24000, currency: 'INR' } }),
    });
    renderAt('/product/alpha-purifier');
    await screen.findByRole('heading', { level: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText(/Alpha Purifier added to your cart/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart');
    const quote = calls.find((c) => c.path === '/store/cart/quote');
    expect(quote.body).toEqual({ items: [{ productId: 'p1', quantity: 2 }] });
    expect(JSON.parse(localStorage.getItem('vr_cart'))).toEqual([{ productId: 'p1', quantity: 2 }]);
    expect(await screen.findByRole('link', { name: 'Cart (2)' })).toBeInTheDocument();
  });

  it('disables purchasing controls when out of stock', async () => {
    mockApi(routes(soldOut));
    renderAt('/product/alpha-purifier');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toBeDisabled();
  });

  it('cannot be added to the cart or booked while no price has been entered', async () => {
    mockApi(routes(makeProduct({ id: 'p9', slug: 'alpha-purifier', name: 'Unpriced', price: 0, maxQuantity: 0, availability: 'in_stock' })));
    renderAt('/product/alpha-purifier');
    await screen.findByRole('heading', { level: 1, name: 'Unpriced' });
    expect(screen.getByRole('button', { name: 'Not available yet' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Book now' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('labels demo products and adds structured data only for real ones', async () => {
    mockApi(routes(demo));
    const { container, unmount } = renderAt('/product/alpha-purifier');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByText(/Demo/).length).toBeGreaterThan(1);
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
    unmount();

    mockApi(routes(alpha));
    const second = renderAt('/product/alpha-purifier');
    await screen.findByRole('heading', { level: 1 });
    const ld = JSON.parse(second.container.querySelector('script[type="application/ld+json"]').textContent);
    expect(ld).toMatchObject({ '@type': 'Product', name: 'Alpha Purifier', offers: { price: 12000, priceCurrency: 'INR' } });
  });

  it('shows a friendly not-found page for unknown or unpublished products', async () => {
    mockApi({
      'GET /store/products/alpha-purifier': () => json(404, { message: 'Product not found.' }),
      'GET /store/products/alpha-purifier/related': () => json(404, { message: 'Product not found.' }),
    });
    renderAt('/product/alpha-purifier');
    expect(await screen.findByRole('heading', { name: 'We could not find that product' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all products' })).toHaveAttribute('href', '/shop');
  });

  it('shows a retryable error for server failures', async () => {
    mockApi({ 'GET /store/products/alpha-purifier': () => json(500, { message: 'x' }), 'GET /store/products/alpha-purifier/related': () => json(500, { message: 'x' }) });
    renderAt('/product/alpha-purifier');
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load this product/i);
  });
});

describe('information pages', () => {
  const pages = [
    ['/about', 'About us'],
    ['/faq', 'Frequently asked questions'],
    ['/shipping-policy', 'Shipping policy'],
    ['/return-refund-policy', 'Return and refund policy'],
    ['/privacy-policy', 'Privacy policy'],
    ['/terms-and-conditions', 'Terms and conditions'],
  ];

  it.each(pages)('%s renders with a heading, a title and honest content (no leftover placeholders)', async (path, heading) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(document.title).toBe(`${heading} | VR Water Solutions`);
    expect(document.querySelector('meta[name="robots"][content*="noindex"]')).toBeNull();
    // No bracketed prompts anywhere: details that were not supplied (opening hours) are simply not shown.
    expect(within(screen.getByRole('main')).queryAllByText(/\[.+\]/)).toHaveLength(0);
  });

  it('shows the not-found page for unknown routes', async () => {
    renderAt('/this-does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('exposes FAQ answers through native disclosure controls', async () => {
    renderAt('/faq');
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelectorAll('details').length).toBeGreaterThanOrEqual(5);
  });
});

describe('site layout', () => {
  it('has primary navigation, a skip link, policy links and no preview notice', async () => {
    mockApi(catalogue);
    renderAt('/about');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Shop', 'About', 'FAQ', 'Contact']) expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy-policy');
    expect(screen.queryByText(/Preview site/)).not.toBeInTheDocument();
  });

  it('opens and closes the mobile menu', async () => {
    renderAt('/about');
    const toggle = await screen.findByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('never loads the admin area for shoppers', async () => {
    const calls = mockApi(catalogue);
    renderAt('/shop');
    await screen.findByRole('heading', { name: 'Alpha Purifier' });
    expect(calls.some((c) => c.path.includes('/admin') || c.path.includes('/auth'))).toBe(false);
  });
});
