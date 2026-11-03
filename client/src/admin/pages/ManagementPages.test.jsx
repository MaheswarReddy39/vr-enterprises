import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../../api/client.js';
import App from '../../app/App.jsx';
import { resetBusiness } from '../../features/business/useBusiness.js';

const admin = { _id: '1', name: 'Asha Admin', email: 'a@example.com', role: 'admin' };
const cara = { _id: '9', name: 'Cara Customer', email: 'cara@example.com', role: 'customer' };
const json = (status, body) => Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(body) });

function mockApi(routes) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, init = {}) => {
      const path = String(url).replace('/api/v1', '');
      calls.push({ path, method: init.method ?? 'GET', body: init.body });
      const handler = routes[`${init.method ?? 'GET'} ${path.split('?')[0]}`];
      return handler ? handler(init) : json(404, { message: `unmocked ${path}` });
    }),
  );
  return calls;
}

const booking = (over = {}) => ({
  id: 'b1', bookingId: 'VR-BK-261103-ABC234', status: 'pending', createdAt: '2026-11-03T10:00:00Z', total: 3000, isRead: false, stockDeducted: false, userId: 'u1',
  items: [{ productId: 'p1', name: 'Alpha Purifier', sku: 'A-1', price: 1500, quantity: 2, lineTotal: 3000 }],
  customer: { name: 'Cara Customer', mobile: '98765 43210', email: 'cara@example.com' },
  deliveryAddress: { line1: '12 Test Road', city: 'Town', state: 'State', postalCode: '560001' },
  statusHistory: [{ status: 'pending', note: 'Booking submitted', at: '2026-11-03T10:00:00Z' }],
  ...over,
});
const stats = {
  bookings: { total: 12, pending: 5, confirmed: 3, processing: 2, completed: 1, rejected: 1, unread: 2 },
  newBookings: [booking()],
  customers: { total: 31, active: 29 },
  products: { published: 8 },
  recentBookings: [booking({ isRead: true, status: 'confirmed' })],
};
const customer = (over = {}) => ({ id: 'c1', name: 'Cara Customer', email: 'cara@example.com', phone: '98765 43210', isActive: true, createdAt: '2026-09-01T00:00:00Z', bookingCount: 2, addresses: [{ id: 'a1', name: 'Cara', line1: '1 Test Road', city: 'Town', state: 'State', postalCode: '560001' }], recentBookings: [booking({ isRead: true })], ...over });
const baseSettings = { business: { name: 'VR Water Solutions', tagline: '', address: '', phone: '', email: '', hours: '', gstin: '', logo: null } };
const pageOf = (items) => ({ items, pagination: { page: 1, limit: 15, total: items.length, totalPages: 1 } });

const as = (user) => ({
  'POST /auth/refresh': () => json(200, { accessToken: 'tok', user }),
  'GET /store/settings': () => json(200, { settings: { name: 'VR Water Solutions', phone: '', email: '', address: '', hours: '', logo: null } }),
  'GET /admin/bookings/unread-count': () => json(200, { unreadCount: 2 }),
});
const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

beforeEach(() => {
  resetBusiness();
  localStorage.setItem('vr_session', '1');
});
afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
  localStorage.clear();
});

describe('Book Now (customer)', () => {
  const product = { id: 'p1', name: 'Alpha Purifier', slug: 'alpha', price: 1500, maxQuantity: 5, primaryImage: null };
  const routes = (extra = {}) => ({
    ...as(cara),
    'GET /store/products/alpha': () => json(200, { product }),
    'GET /account/addresses': () => json(200, { addresses: [] }),
    ...extra,
  });
  const fill = async () => {
    await userEvent.clear(screen.getByLabelText(/Full name/));
    await userEvent.type(screen.getByLabelText(/Full name/), 'Cara Customer');
    await userEvent.type(screen.getByLabelText(/Mobile number/), '98765 43210');
    await userEvent.type(screen.getByLabelText(/Address line 1/), '12 Test Road');
    await userEvent.type(screen.getByLabelText('City', { exact: false }), 'Town');
    await userEvent.type(screen.getByLabelText(/^State/), 'State');
    await userEvent.type(screen.getByLabelText(/Postal code/), '560001');
  };

  it('requires login before booking', async () => {
    mockApi({ 'POST /auth/refresh': () => json(401, {}), 'GET /store/settings': () => json(200, { settings: {} }) });
    renderAt('/book?product=alpha&quantity=2');
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows the product, quantity and displayed price, and takes no payment', async () => {
    mockApi(routes());
    renderAt('/book?product=alpha&quantity=2');
    expect(await screen.findByText('Alpha Purifier')).toBeInTheDocument();
    expect(screen.getByText('₹1,500.00 × 2')).toBeInTheDocument();
    expect(screen.getAllByText('₹3,000.00').length).toBeGreaterThan(0);
    expect(screen.getByText(/no payment is taken/i)).toBeInTheDocument();
    expect(screen.queryByText(/razorpay|pay now/i)).not.toBeInTheDocument();
  });

  it('validates the form before calling the API', async () => {
    const calls = mockApi(routes());
    renderAt('/book?product=alpha');
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm booking' }));
    expect(await screen.findByText('Enter a valid mobile number.')).toBeInTheDocument();
    expect(screen.getByText('Enter the street address.')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/account/bookings')).toBe(false);
  });

  it('submits the booking without any price and shows the booking ID', async () => {
    const calls = mockApi(routes({ 'POST /account/bookings': () => json(201, { booking: booking() }) }));
    renderAt('/book?product=alpha&quantity=2');
    await screen.findByText('Alpha Purifier');
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(await screen.findByRole('heading', { name: 'Booking received' })).toBeInTheDocument();
    expect(screen.getByText('VR-BK-261103-ABC234')).toBeInTheDocument();
    const sent = JSON.parse(calls.find((c) => c.method === 'POST' && c.path === '/account/bookings').body);
    expect(sent.items).toEqual([{ productId: 'p1', quantity: 2 }]);
    expect(sent.name).toBe('Cara Customer');
    expect(sent.mobile).toBe('98765 43210');
    expect(sent.address.line1).toBe('12 Test Road');
    expect(JSON.stringify(sent)).not.toMatch(/price|total/i);
  });

  it('sends only one request when the confirm button is clicked repeatedly', async () => {
    let release;
    const calls = mockApi(routes({ 'POST /account/bookings': () => new Promise((resolve) => { release = () => resolve({ status: 201, ok: true, json: () => Promise.resolve({ booking: booking() }) }); }) }));
    renderAt('/book?product=alpha&quantity=2');
    await screen.findByText('Alpha Purifier');
    await fill();
    const button = screen.getByRole('button', { name: 'Confirm booking' });
    await userEvent.dblClick(button);
    await userEvent.click(button);
    await waitFor(() => expect(calls.filter((c) => c.path === '/account/bookings')).toHaveLength(1));
    release();
    expect(await screen.findByRole('heading', { name: 'Booking received' })).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/account/bookings')).toHaveLength(1);
  });

  it('shows the server message when stock is not enough', async () => {
    mockApi(routes({ 'POST /account/bookings': () => json(409, { message: 'Only 1 of "Alpha Purifier" is available.' }) }));
    renderAt('/book?product=alpha&quantity=2');
    await screen.findByText('Alpha Purifier');
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only 1 of "Alpha Purifier" is available.');
  });
});

describe('My bookings (customer)', () => {
  it('lists bookings with their status and opens one', { timeout: 15000 }, async () => {
    mockApi({
      ...as(cara),
      'GET /account/bookings': () => json(200, pageOf([booking({ status: 'confirmed' }), booking({ id: 'b2', bookingId: 'VR-BK-261103-ZZZ999', status: 'rejected' })])),
      'GET /account/bookings/b1': () => json(200, { booking: booking({ status: 'confirmed', statusHistory: [{ status: 'confirmed', note: 'See you soon', at: '2026-11-03T11:00:00Z' }] }) }),
    });
    renderAt('/account/bookings');
    expect(await screen.findByRole('link', { name: 'VR-BK-261103-ABC234' })).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'VR-BK-261103-ABC234' }));
    expect(await screen.findByText(/See you soon/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Booking progress' })).toBeInTheDocument();
  });
});

describe('admin dashboard', () => {
  it('shows the New Booking alert, the booking counts and recent bookings', async () => {
    mockApi({
      ...as(admin),
      'GET /admin/dashboard/stats': () => json(200, stats),
      'GET /admin/dashboard/summary': () => json(200, { products: {}, inventory: { low: 2, out: 1 } }),
    });
    renderAt('/admin');
    expect(await screen.findByText(/New bookings: 2 unread/)).toBeInTheDocument();
    for (const label of ['Total bookings', 'Pending bookings', 'Confirmed bookings', 'Processing bookings', 'Completed bookings', 'Rejected bookings']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pending bookings 5' })).toHaveAttribute('href', '/admin/bookings?status=pending');
    expect(screen.getByRole('link', { name: /2 new bookings/ })).toHaveAttribute('href', '/admin/bookings?unread=true');
    expect(screen.queryByText(/revenue|payment/i)).not.toBeInTheDocument();
  });

  it('hides the alert when nothing is unread', async () => {
    mockApi({
      ...as(admin),
      'GET /admin/dashboard/stats': () => json(200, { ...stats, bookings: { ...stats.bookings, unread: 0 }, newBookings: [] }),
      'GET /admin/dashboard/summary': () => json(200, { products: {}, inventory: { low: 0, out: 0 } }),
    });
    renderAt('/admin');
    await screen.findByText('Total bookings');
    expect(screen.queryByText(/New bookings?: /)).not.toBeInTheDocument();
  });
});

describe('admin bookings', () => {
  it('highlights unread bookings and marks them all read', async () => {
    const calls = mockApi({
      ...as(admin),
      'GET /admin/bookings': () => json(200, { ...pageOf([booking(), booking({ id: 'b2', bookingId: 'VR-BK-261103-OLD111', isRead: true })]), unreadCount: 1 }),
      'POST /admin/bookings/read-all': () => json(200, { updated: 1 }),
    });
    renderAt('/admin/bookings');
    expect(await screen.findByRole('link', { name: 'VR-BK-261103-ABC234' })).toBeInTheDocument();
    expect(screen.getAllByText('New')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Mark all 1 as read' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/bookings/read-all')).toBe(true));
  });

  it('shows customer, product, quantity, address and date, and confirms only after the dialog', async () => {
    let status = 'pending';
    const calls = mockApi({
      ...as(admin),
      'GET /admin/bookings/b1': () => json(200, { booking: booking({ status, isRead: true, stockDeducted: status !== 'pending' }) }),
      'PATCH /admin/bookings/b1/status': (init) => { status = JSON.parse(init.body).status; return json(200, { booking: booking({ status }) }); },
    });
    renderAt('/admin/bookings/b1');
    expect(await screen.findByRole('heading', { name: 'VR-BK-261103-ABC234' })).toBeInTheDocument();
    expect(screen.getByText('Cara Customer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '98765 43210' })).toHaveAttribute('href', 'tel:9876543210');
    expect(screen.getByText('Alpha Purifier')).toBeInTheDocument();
    expect(screen.getByText(/× 2/)).toBeInTheDocument();
    expect(screen.getByText('12 Test Road')).toBeInTheDocument();
    expect(screen.getByText(/Booked/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm booking' }));
    await waitFor(() => expect(JSON.parse(calls.find((c) => c.method === 'PATCH').body)).toEqual({ status: 'confirmed' }));
    expect(await screen.findByRole('button', { name: 'Start processing' })).toBeInTheDocument();
  });

  it('rejects with a note the customer will see', async () => {
    const calls = mockApi({
      ...as(admin),
      'GET /admin/bookings/b1': () => json(200, { booking: booking({ isRead: true }) }),
      'PATCH /admin/bookings/b1/status': () => json(200, { booking: booking({ status: 'rejected' }) }),
    });
    renderAt('/admin/bookings/b1');
    await userEvent.type(await screen.findByLabelText(/Note/), 'Out of delivery area');
    await userEvent.click(screen.getByRole('button', { name: 'Reject booking' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reject booking' }));
    await waitFor(() => expect(JSON.parse(calls.find((c) => c.method === 'PATCH').body)).toEqual({ status: 'rejected', note: 'Out of delivery area' }));
  });

  it('marks a booking read or unread on request', async () => {
    const calls = mockApi({
      ...as(admin),
      'GET /admin/bookings/b1': () => json(200, { booking: booking({ isRead: true }) }),
      'PATCH /admin/bookings/b1/read': () => json(200, { booking: booking({ isRead: false }) }),
    });
    renderAt('/admin/bookings/b1');
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as unread' }));
    await waitFor(() => expect(JSON.parse(calls.find((c) => c.path.endsWith('/read') && c.method === 'PATCH').body)).toEqual({ isRead: false }));
  });

  it('offers no actions on a finished booking', async () => {
    mockApi({ ...as(admin), 'GET /admin/bookings/b1': () => json(200, { booking: booking({ status: 'completed', isRead: true }) }) });
    renderAt('/admin/bookings/b1');
    expect(await screen.findByText(/No further action is possible/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm|reject|processing|completed/i })).not.toBeInTheDocument();
  });
});

describe('admin WhatsApp notifications', () => {
  const note = (over = {}) => ({ id: 'n1', bookingRef: 'b1', bookingId: 'VR-BK-261103-ABC234', kind: 'customer_status', status: 'confirmed', to: '+91 ••••• 43210', template: 't', state: 'failed', attempts: 1, lastError: '[190] Invalid token', createdAt: '2026-11-03T10:00:00Z', ...over });
  const page = (items, configured = true) => ({ items, pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 }, failedCount: items.filter((n) => n.state === 'failed').length, whatsapp: { configured } });

  it('shows failed messages with a safe error and retries one', { timeout: 15000 }, async () => {
    let state = 'failed';
    const calls = mockApi({
      ...as(admin),
      'GET /admin/notifications': () => json(200, page([note({ state })])),
      'POST /admin/notifications/n1/retry': () => { state = 'sent'; return json(200, { notification: note({ state: 'sent', lastError: '' }) }); },
    });
    renderAt('/admin/notifications');
    const table = await screen.findByRole('table', { name: 'WhatsApp notifications' });
    expect(within(table).getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('[190] Invalid token')).toBeInTheDocument();
    expect(screen.getByText('+91 ••••• 43210')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Sent')).toBeInTheDocument());
    expect(calls.filter((c) => c.method === 'POST' && c.path === '/admin/notifications/n1/retry')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('explains when WhatsApp is not set up yet', async () => {
    mockApi({ ...as(admin), 'GET /admin/notifications': () => json(200, page([note({ state: 'skipped', lastError: 'WhatsApp is not configured on the server yet.' })], false)) });
    renderAt('/admin/notifications');
    expect(await screen.findByText(/WhatsApp is not set up on the server yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows the messages of one booking on its page, and a failure alert on the dashboard', async () => {
    mockApi({
      ...as(admin),
      'GET /admin/bookings/b1': () => json(200, { booking: booking({ isRead: true }) }),
      'GET /admin/notifications': () => json(200, page([note({ kind: 'admin_new_booking', status: '', state: 'sent', lastError: '' })])),
      'GET /admin/dashboard/stats': () => json(200, { ...stats, notifications: { failed: 2 } }),
      'GET /admin/dashboard/summary': () => json(200, { products: {}, inventory: { low: 0, out: 0 } }),
    });
    const { unmount } = renderAt('/admin/bookings/b1');
    expect(await screen.findByRole('heading', { name: 'WhatsApp messages' })).toBeInTheDocument();
    expect(await screen.findByText('Alert to business')).toBeInTheDocument();
    unmount();
    renderAt('/admin');
    expect(await screen.findByText(/2 WhatsApp messages could not be sent/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review and retry' })).toHaveAttribute('href', '/admin/notifications?state=failed');
  });
});

describe('admin customers', () => {
  it('lists customers, searches and links to the profile', async () => {
    const calls = mockApi({ ...as(admin), 'GET /admin/customers': () => json(200, pageOf([customer()])) });
    renderAt('/admin/customers');
    expect(await screen.findByRole('link', { name: 'Cara Customer' })).toHaveAttribute('href', '/admin/customers/c1');
    await userEvent.type(screen.getByLabelText('Search'), 'cara');
    await waitFor(() => expect(calls.some((c) => c.path.includes('/admin/customers?') && c.path.includes('q=cara'))).toBe(true));
  });

  it('shows a profile with bookings and deactivates the account after confirmation', async () => {
    const calls = mockApi({
      ...as(admin),
      'GET /admin/customers/c1': () => json(200, { customer: customer() }),
      'PATCH /admin/customers/c1/status': () => json(200, { customer: customer({ isActive: false }) }),
    });
    renderAt('/admin/customers/c1');
    expect(await screen.findByRole('heading', { name: 'Cara Customer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All bookings' })).toHaveAttribute('href', '/admin/bookings?customer=c1');
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate account' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH').body).toBe(JSON.stringify({ isActive: false })));
  });

  it('lets staff view customers but not change their status', async () => {
    mockApi({ ...as({ ...admin, role: 'staff' }), 'GET /admin/customers/c1': () => json(200, { customer: customer() }) });
    renderAt('/admin/customers/c1');
    expect(await screen.findByRole('heading', { name: 'Cara Customer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
  });
});

describe('store settings', () => {
  it('is hidden from staff', async () => {
    mockApi(as({ ...admin, role: 'staff' }));
    renderAt('/admin/settings');
    expect(await screen.findByText(/Only the store administrator/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Store settings' })).not.toBeInTheDocument();
  });

  it('has business details only: no shipping, tax or invoice settings', async () => {
    mockApi({ ...as(admin), 'GET /admin/settings': () => json(200, { settings: baseSettings }) });
    renderAt('/admin/settings');
    await screen.findByLabelText('Business name');
    expect(screen.queryByText(/shipping|tax|invoice/i)).not.toBeInTheDocument();
  });

  it('saves the business details in the shape the API expects', async () => {
    let saved;
    mockApi({
      ...as(admin),
      'GET /admin/settings': () => json(200, { settings: baseSettings }),
      'PUT /admin/settings': (init) => {
        saved = JSON.parse(init.body);
        return json(200, { settings: { business: { ...baseSettings.business, ...saved.business } } });
      },
    });
    renderAt('/admin/settings');
    await userEvent.type(await screen.findByLabelText('Phone'), '+91 98765 43210');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save settings' })[0]);
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
    expect(Object.keys(saved)).toEqual(['business']);
    expect(saved.business.phone).toBe('+91 98765 43210');
  });

  it('shows the server-side validation message next to the field', async () => {
    mockApi({
      ...as(admin),
      'GET /admin/settings': () => json(200, { settings: baseSettings }),
      'PUT /admin/settings': () => json(400, { message: 'Validation failed.', details: [{ path: 'body.business.email', message: 'Enter a valid email address.' }] }),
    });
    renderAt('/admin/settings');
    await userEvent.type(await screen.findByLabelText('Phone'), '12345');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save settings' })[0]);
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  });
});

describe('storefront business details', () => {
  it('shows the saved phone and email in the footer instead of placeholders', async () => {
    mockApi({
      'POST /auth/refresh': () => json(401, {}),
      'GET /store/settings': () => json(200, { settings: { name: 'Saved Business', phone: '+91 90000 11111', email: 'hello@saved.example', address: '5 Saved Street', hours: '', logo: null } }),
    });
    renderAt('/contact');
    expect(await screen.findByRole('link', { name: '+91 90000 11111' })).toHaveAttribute('href', 'tel:+919000011111');
    expect(screen.getAllByText('5 Saved Street').length).toBeGreaterThan(0);
  });
});
