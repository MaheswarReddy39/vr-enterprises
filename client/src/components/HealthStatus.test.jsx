import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthStatus } from './HealthStatus.jsx';

const mockFetch = (impl) => vi.stubGlobal('fetch', vi.fn(impl));

afterEach(() => vi.unstubAllGlobals());

describe('HealthStatus', () => {
  it('shows service states returned by the API', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ status: 'ok', services: { database: 'connected', transactions: 'supported', imageStorage: 'gridfs' } }),
      }),
    );
    render(<HealthStatus />);
    // Both the API row and the Database row read "connected".
    expect(await screen.findAllByText('connected')).toHaveLength(3);
    expect(screen.getByText('supported')).toBeInTheDocument();
  });

  it('shows an error when the API cannot be reached', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    render(<HealthStatus />);
    expect(await screen.findByRole('alert')).toHaveTextContent('API unreachable');
  });
});
