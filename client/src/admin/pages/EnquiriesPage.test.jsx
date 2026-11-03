import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui/Toast.jsx';
import { AuthProvider } from '../../features/auth/AuthContext.jsx';
import { json, mockApi } from '../../test/storeFixtures.js';
import EnquiriesPage from './EnquiriesPage.jsx';

beforeEach(() => localStorage.setItem('vr_session', '1'));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const enquiry = { _id: 'e1', name: 'Sample Visitor', email: 'v@example.com', phone: '', message: 'Hello there, please advise.', productName: 'Alpha', status: 'new', createdAt: '2026-11-03T02:57:00Z' };

describe('admin enquiries', () => {
  it('lists enquiries and updates their status', async () => {
    const calls = mockApi({
      'POST /auth/refresh': () => json(200, { accessToken: 't', user: { _id: 'u', name: 'Admin', role: 'admin' } }),
      'GET /admin/enquiries': () => json(200, { success: true, items: [enquiry], unread: 1, pagination: { page: 1, limit: 15, total: 1, totalPages: 1 } }),
      'PATCH /admin/enquiries/e1': () => json(200, { success: true, enquiry: { ...enquiry, status: 'read' } }),
    });
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <EnquiriesPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Sample Visitor')).toBeInTheDocument();
    expect(screen.getByText('Hello there, please advise.')).toBeInTheDocument();
    expect(screen.getByText('1 new')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Status for enquiry from Sample Visitor'), 'read');
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.body.status === 'read')).toBe(true));
  });
});
