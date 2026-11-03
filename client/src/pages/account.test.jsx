import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../api/client.js';
import App from '../app/App.jsx';
import { passwordProblems } from './AccountPages.jsx';
import { json, makeProduct, mockApi } from '../test/storeFixtures.js';

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

const customer = { _id: 'u1', name: 'Cara Customer', email: 'cara@example.com', role: 'customer' };
const session = (user = customer) => ({ success: true, accessToken: 'tok', user });
const line = (over = {}) => ({ productId: 'p1', slug: 'alpha-purifier', name: 'Alpha Purifier', sku: 'ALP-001', price: 1000, mrp: null, isDemo: false, image: null, quantity: 1, maxQuantity: 5, availability: 'in_stock', available: true, issue: null, lineTotal: 1000, ...over });
const cartOf = (lines) => ({ success: true, cart: { lines, itemCount: lines.filter((l) => l.available).reduce((n, l) => n + l.quantity, 0), subtotal: lines.reduce((n, l) => n + l.lineTotal, 0), currency: 'INR' } });

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
  localStorage.clear();
});

describe('passwordProblems', () => {
  it('lists what is missing and accepts a strong password', () => {
    expect(passwordProblems('Str0ng!Passw0rd')).toEqual([]);
    expect(passwordProblems('abc')).toEqual(['at least 10 characters', 'an upper case letter', 'a number', 'a symbol']);
  });
});

describe('session handling', () => {
  it('does not contact the server for visitors who have never signed in', async () => {
    const calls = mockApi({ 'GET /store/banners': () => json(200, { success: true, items: [] }), 'GET /store/products': () => json(200, { success: true, items: [], pagination: { page: 1, limit: 4, total: 0, totalPages: 1 } }), 'GET /store/categories': () => json(200, { success: true, items: [] }) });
    renderAt('/');
    await screen.findByRole('heading', { level: 1 });
    expect(calls.some((c) => c.path.startsWith('/auth/'))).toBe(false);
  });

  it('restores a customer session on reload when the browser has signed in before', async () => {
    localStorage.setItem('vr_session', '1');
    mockApi({ 'POST /auth/refresh': () => json(200, session()), 'GET /account/cart': () => json(200, cartOf([])), 'GET /account/wishlist': () => json(200, { success: true, items: [], ids: [] }) });
    renderAt('/account');
    expect(await screen.findByRole('heading', { level: 1, name: 'Your account' })).toBeInTheDocument();
    expect(screen.getByText('cara@example.com')).toBeInTheDocument();
  });

  it('sends signed-out visitors from /account to the sign-in page', async () => {
    mockApi({});
    renderAt('/account');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('sign in and register', () => {
  it('validates sign-in fields before calling the server', async () => {
    const calls = mockApi({});
    renderAt('/account/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toHaveLength(0);
  });

  it('signs in, remembers the browser and shows the server error for bad credentials', async () => {
    mockApi({ 'POST /auth/login': () => json(401, { message: 'Invalid email or password.' }) });
    renderAt('/account/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'cara@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(localStorage.getItem('vr_session')).toBeNull();

    mockApi({ 'POST /auth/login': () => json(200, session()), 'GET /account/cart': () => json(200, cartOf([])), 'GET /account/wishlist': () => json(200, { success: true, items: [], ids: [] }) });
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your account' })).toBeInTheDocument();
    expect(localStorage.getItem('vr_session')).toBe('1');
  });

  it('registers a customer with client-side password checks and sends no role', async () => {
    const calls = mockApi({ 'POST /auth/register': () => json(201, session()), 'GET /account/cart': () => json(200, cartOf([])), 'GET /account/wishlist': () => json(200, { success: true, items: [], ids: [] }) });
    renderAt('/account/register');
    await userEvent.type(await screen.findByLabelText('Full name'), 'Cara Customer');
    await userEvent.type(screen.getByLabelText('Email'), 'cara@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'weak');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText(/Your password needs at least 10 characters/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/auth/register')).toBe(false);

    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your account' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/auth/register').body).toEqual({ name: 'Cara Customer', email: 'cara@example.com', password: 'Str0ng!Passw0rd' });
  });

  it('shows server-side field errors such as an existing email', async () => {
    mockApi({ 'POST /auth/register': () => json(409, { message: 'An account with this email already exists. Try signing in instead.' }) });
    renderAt('/account/register');
    await userEvent.type(await screen.findByLabelText('Full name'), 'Cara Customer');
    await userEvent.type(screen.getByLabelText('Email'), 'cara@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });
});

describe('account page', () => {
  const signedIn = () => {
    localStorage.setItem('vr_session', '1');
    return {
      'POST /auth/refresh': () => json(200, session()),
      'GET /account/cart': () => json(200, cartOf([])),
      'GET /account/wishlist': () => json(200, { success: true, items: [], ids: [] }),
    };
  };

  it('updates the profile', async () => {
    const calls = mockApi({ ...signedIn(), 'PATCH /account/me': () => json(200, { success: true, user: { ...customer, name: 'Cara Renamed' } }) });
    renderAt('/account');
    const form = await screen.findByRole('form', { name: 'Profile' });
    const name = within(form).getByLabelText('Full name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Cara Renamed');
    await userEvent.click(within(form).getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ name: 'Cara Renamed', phone: '' });
  });

  it('changes the password with validation and keeps the shopper signed in', async () => {
    const calls = mockApi({ ...signedIn(), 'POST /account/change-password': () => json(200, session()) });
    renderAt('/account');
    const form = await screen.findByRole('form', { name: 'Change password' });
    await userEvent.type(within(form).getByLabelText('Current password'), 'Old!Passw0rd1');
    await userEvent.type(within(form).getByLabelText('New password'), 'short');
    await userEvent.click(within(form).getByRole('button', { name: 'Change password' }));
    expect(within(form).getByText(/Your new password needs/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/account/change-password')).toBe(false);

    await userEvent.clear(within(form).getByLabelText('New password'));
    await userEvent.type(within(form).getByLabelText('New password'), 'N3w!Passw0rd-ok');
    await userEvent.click(within(form).getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/Password changed/)).toBeInTheDocument();
  });

  it('signs out and clears the remembered session', async () => {
    mockApi({ ...signedIn(), 'POST /auth/logout': () => json(200, { success: true }), 'GET /store/banners': () => json(200, { success: true, items: [] }), 'GET /store/products': () => json(200, { success: true, items: [], pagination: { page: 1, limit: 4, total: 0, totalPages: 1 } }), 'GET /store/categories': () => json(200, { success: true, items: [] }) });
    renderAt('/account');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(localStorage.getItem('vr_session')).toBeNull());
    expect(await screen.findByRole('heading', { level: 1, name: /right water purifier/i })).toBeInTheDocument();
  });

  it('keeps customers out of the admin area', async () => {
    mockApi(signedIn());
    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
    expect(screen.getByText(/signed in as a customer/i)).toBeInTheDocument();
  });
});

describe('cart page', () => {
  const catalogue = {};

  it('shows an empty cart with a way to start shopping', async () => {
    mockApi(catalogue);
    renderAt('/cart');
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop purifiers' })).toHaveAttribute('href', '/shop');
  });

  it('prices a guest cart from the server, never from stored data, and offers booking', async () => {
    localStorage.setItem('vr_cart', JSON.stringify([{ productId: 'p1', quantity: 2 }]));
    const calls = mockApi({ 'POST /store/cart/quote': () => json(200, cartOf([line({ quantity: 2, lineTotal: 2000 })])) });
    renderAt('/cart');
    expect(await screen.findByRole('link', { name: 'Alpha Purifier' })).toHaveAttribute('href', '/product/alpha-purifier');
    expect(screen.getAllByText(/₹2,000/).length).toBeGreaterThan(0);
    expect(calls.find((c) => c.path === '/store/cart/quote').body).toEqual({ items: [{ productId: 'p1', quantity: 2 }] });
    expect(screen.getByRole('link', { name: 'Sign in to book' })).toHaveAttribute('href', '/account/login');
    expect(JSON.stringify(localStorage.getItem('vr_cart'))).not.toMatch(/price/);
  });

  it('changes quantity and removes lines', async () => {
    localStorage.setItem('vr_cart', JSON.stringify([{ productId: 'p1', quantity: 1 }]));
    let current = line();
    const calls = mockApi({ 'POST /store/cart/quote': (_p, init) => { const items = JSON.parse(init.body).items; current = items.length ? line({ quantity: items[0].quantity, lineTotal: 1000 * items[0].quantity }) : null; return json(200, cartOf(current ? [current] : [])); } });
    renderAt('/cart');
    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity of alpha purifier' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('vr_cart'))).toEqual([{ productId: 'p1', quantity: 2 }]));
    await userEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
    expect(localStorage.getItem('vr_cart')).toBeNull();
    expect(calls.filter((c) => c.path === '/store/cart/quote')).toHaveLength(2); // initial load + quantity change; an empty cart needs no request
  });

  it('explains stock problems and blocks nothing silently', async () => {
    localStorage.setItem('vr_cart', JSON.stringify([{ productId: 'p1', quantity: 9 }, { productId: 'p2', quantity: 1 }, { productId: 'p3', quantity: 1 }]));
    mockApi({
      'POST /store/cart/quote': () => json(200, cartOf([
        line({ quantity: 3, maxQuantity: 3, issue: 'quantity_reduced', lineTotal: 3000 }),
        line({ productId: 'p2', name: 'Sold Out', slug: 'sold-out', available: false, issue: 'out_of_stock', maxQuantity: 0, availability: 'out_of_stock', lineTotal: 0 }),
        { productId: 'p3', available: false, issue: 'unavailable', quantity: 1, lineTotal: 0 },
      ])),
    });
    renderAt('/cart');
    expect(await screen.findByText('Only 3 available, so the quantity was reduced.')).toBeInTheDocument();
    expect(screen.getByText(/currently out of stock/)).toBeInTheDocument();
    expect(screen.getAllByText(/no longer available/).length).toBeGreaterThan(0);
    expect(screen.getByText('Remove unavailable products before checking out.')).toBeInTheDocument();
  });

  it('uses the account cart when signed in and merges the guest cart on sign-in', async () => {
    localStorage.setItem('vr_cart', JSON.stringify([{ productId: 'p1', quantity: 2 }]));
    localStorage.setItem('vr_session', '1');
    const calls = mockApi({
      'POST /auth/refresh': () => json(200, session()),
      'POST /account/cart/merge': () => json(200, cartOf([line({ quantity: 3, lineTotal: 3000 })])),
      'GET /account/wishlist': () => json(200, { success: true, items: [], ids: [] }),
    });
    renderAt('/cart');
    expect(await screen.findByRole('link', { name: 'Alpha Purifier' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/account/cart/merge').body).toEqual({ items: [{ productId: 'p1', quantity: 2 }] });
    expect(calls.some((c) => c.path === '/store/cart/quote')).toBe(false);
    await waitFor(() => expect(localStorage.getItem('vr_cart')).toBeNull());
  });
});

describe('wishlist', () => {
  it('lets guests save and remove products, persisted on this device', async () => {
    const product = makeProduct();
    mockApi({
      'GET /store/categories': () => json(200, { success: true, items: [] }),
      'GET /store/products': () => json(200, { success: true, items: [product], pagination: { page: 1, limit: 12, total: 1, totalPages: 1 } }),
      'POST /store/products/lookup': () => json(200, { success: true, items: [product] }),
    });
    renderAt('/shop');
    const heart = await screen.findByRole('button', { name: 'Save Alpha Purifier to wishlist' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(heart);
    expect(await screen.findByRole('button', { name: 'Remove Alpha Purifier from wishlist' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('vr_wishlist'))).toEqual(['p1']);
    expect(await screen.findByRole('link', { name: 'Wishlist (1)' })).toBeInTheDocument();
  });

  it('shows saved products on the wishlist page and offers an empty state', async () => {
    const product = makeProduct();
    localStorage.setItem('vr_wishlist', JSON.stringify(['p1']));
    mockApi({ 'POST /store/products/lookup': () => json(200, { success: true, items: [product] }) });
    const { unmount } = renderAt('/wishlist');
    expect(await screen.findByRole('heading', { name: 'Alpha Purifier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeInTheDocument();
    unmount();

    localStorage.clear();
    mockApi({});
    renderAt('/wishlist');
    expect(await screen.findByText('Your wishlist is empty')).toBeInTheDocument();
  });

  it('merges the guest wishlist into the account on sign-in', async () => {
    localStorage.setItem('vr_wishlist', JSON.stringify(['p1']));
    localStorage.setItem('vr_session', '1');
    const calls = mockApi({
      'POST /auth/refresh': () => json(200, session()),
      'GET /account/cart': () => json(200, cartOf([])),
      'POST /account/wishlist/merge': () => json(200, { success: true, items: [makeProduct()], ids: ['p1'] }),
      'GET /account/wishlist': () => json(200, { success: true, items: [makeProduct()], ids: ['p1'] }),
    });
    renderAt('/wishlist');
    expect(await screen.findByRole('heading', { name: 'Alpha Purifier' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/account/wishlist/merge').body).toEqual({ ids: ['p1'] });
    await waitFor(() => expect(localStorage.getItem('vr_wishlist')).toBeNull());
  });
});
