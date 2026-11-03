import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../api/client.js';
import App from '../app/App.jsx';

const admin = { _id: '1', name: 'Asha Admin', email: 'a@example.com', role: 'admin' };
const json = (status, body) => Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(body) });

/** Fake API: routes calls by path so each test declares only what it needs. */
function mockApi(routes) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, init = {}) => {
      const path = String(url).replace('/api/v1', '');
      calls.push({ path, method: init.method ?? 'GET', headers: init.headers });
      const handler = routes[`${init.method ?? 'GET'} ${path.split('?')[0]}`];
      return handler ? handler() : json(404, { message: `unmocked ${path}` });
    }),
  );
  return calls;
}

const stats = {
  bookings: { total: 4, pending: 2, confirmed: 1, processing: 0, completed: 1, rejected: 0, unread: 1 },
  newBookings: [],
  customers: { total: 7, active: 6 },
  products: { published: 3 },
  recentBookings: [],
};

const signedIn = {
  'GET /admin/dashboard/stats': () => json(200, stats),
  'GET /admin/bookings/unread-count': () => json(200, { unreadCount: 1 }),
  'POST /auth/refresh': () => json(200, { accessToken: 'tok', user: admin }),
  'GET /admin/dashboard/summary': () =>
    json(200, { products: { total: 3, published: 1, draft: 2, archived: 0, featured: 1 }, inventory: { low: 1, out: 0 } }),
};

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

// The app only asks the server to restore a session when this browser has signed in before.
beforeEach(() => localStorage.setItem('vr_session', '1'));
afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
  localStorage.clear();
});

describe('admin route protection', () => {
  it('redirects to the login page when there is no session', async () => {
    mockApi({ 'POST /auth/refresh': () => json(401, { message: 'Not signed in.' }) });
    renderAt('/admin/products');
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
  });

  it('shows admin content once the session is confirmed, and sends the token with API calls', async () => {
    const calls = mockApi(signedIn);
    renderAt('/admin');
    expect(await screen.findByText('Total bookings')).toBeInTheDocument();
    const summary = calls.find((c) => c.path === '/admin/dashboard/summary');
    expect(summary.headers.Authorization).toBe('Bearer tok');
  });

  it('does not let a customer account into the admin area', async () => {
    mockApi({ 'POST /auth/refresh': () => json(200, { accessToken: 't', user: { ...admin, role: 'customer' } }) });
    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
  });
});

describe('login form', () => {
  it('validates required fields accessibly before calling the API', async () => {
    const calls = mockApi({ 'POST /auth/refresh': () => json(401, {}) });
    renderAt('/admin/login');
    await userEvent.click(await screen.findByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.some((c) => c.path === '/auth/login')).toBe(false);
  });

  it('shows the server error for bad credentials', async () => {
    mockApi({
      'POST /auth/refresh': () => json(401, {}),
      'POST /auth/login': () => json(401, { message: 'Invalid email or password.' }),
    });
    renderAt('/admin/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('signs in and lands on the dashboard', async () => {
    mockApi({
      ...signedIn,
      'POST /auth/refresh': () => json(401, {}),
      'POST /auth/login': () => json(200, { accessToken: 'tok', user: admin }),
    });
    renderAt('/admin/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Total bookings')).toBeInTheDocument();
  });
});

describe('admin shell', () => {
  it('lists the admin modules', async () => {
    mockApi(signedIn);
    renderAt('/admin');
    await screen.findByText('Total bookings');
    for (const label of ['Products', 'Bookings', 'Customers', 'Store settings', 'Categories', 'Brands', 'Featured products', 'Inventory', 'Homepage banners']) {
      expect(screen.getAllByRole('link', { name: new RegExp(`^${label}`) }).length).toBeGreaterThan(0);
    }
  });

  it('opens and closes the mobile navigation drawer', async () => {
    mockApi(signedIn);
    renderAt('/admin');
    const toggle = await screen.findByRole('button', { name: 'Open navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows a 404 for unknown admin pages', async () => {
    mockApi(signedIn);
    renderAt('/admin/not-a-module');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('signs out and returns to the login page', async () => {
    mockApi({ ...signedIn, 'POST /auth/logout': () => json(200, { success: true }) });
    renderAt('/admin');
    await screen.findByText('Total bookings');
    await userEvent.click(screen.getAllByRole('button', { name: /sign out/i })[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument());
  });
});
