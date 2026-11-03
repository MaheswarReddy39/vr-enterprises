import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import { AuthProvider } from '../../features/auth/AuthContext.jsx';
import { json, mockApi } from '../../test/storeFixtures.js';
import BannersPage from './BannersPage.jsx';

const img = { url: '/api/v1/media/a', thumbUrl: '/api/v1/media/t' };
const items = [
  { _id: 'b1', title: 'First Banner', subtitle: '', ctaLabel: '', linkUrl: '/shop', isActive: true, startsAt: null, endsAt: null, image: img },
  { _id: 'b2', title: 'Second Banner', subtitle: '', ctaLabel: '', linkUrl: '', isActive: false, startsAt: null, endsAt: null },
];

beforeEach(() => localStorage.setItem('vr_session', '1'));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const setup = (extra = {}) => {
  const calls = mockApi({
    'POST /auth/refresh': () => json(200, { accessToken: 't', user: { _id: 'u', name: 'Admin', role: 'admin' } }),
    'GET /admin/banners': () => json(200, { success: true, items }),
    ...extra,
  });
  render(<MemoryRouter><ToastProvider><AuthProvider><BannersPage /></AuthProvider></ToastProvider></MemoryRouter>);
  return calls;
};

describe('admin banners page', () => {
  it('lists banners with status and warns about missing pictures', async () => {
    setup();
    expect(await screen.findByText('First Banner')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Not shown until a picture is added.')).toBeInTheDocument();
  });

  it('reorders banners through the API', async () => {
    const calls = setup({ 'PUT /admin/banners/order': () => json(200, { success: true, items: [items[1], items[0]] }) });
    await screen.findByText('First Banner');
    await userEvent.click(screen.getByRole('button', { name: 'Move First Banner down' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ order: ['b2', 'b1'] }));
    expect(screen.getByRole('button', { name: 'Move First Banner up' })).toBeDisabled();
  });

  it('asks for confirmation before deleting and validates the form before saving', async () => {
    const calls = setup({ 'DELETE /admin/banners/b1': () => json(200, { success: true }) });
    await screen.findByText('First Banner');
    await userEvent.click(screen.getByRole('button', { name: 'Delete First Banner' }));
    expect(screen.getByRole('dialog', { name: 'Delete this banner?' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getAllByRole('button', { name: /New banner/ })[0]);
    await userEvent.type(screen.getByLabelText('Title *'), 'Promo');
    await userEvent.type(screen.getByLabelText('Link'), 'javascript:alert(1)');
    await userEvent.click(screen.getByRole('button', { name: 'Create banner' }));
    expect(await screen.findByText('Use a site path like /shop or a full https:// address.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/banners')).toBe(false);
  });
});
