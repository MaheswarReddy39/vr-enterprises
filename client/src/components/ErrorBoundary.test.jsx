import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary, isChunkLoadError, lazyWithRetry } from './ErrorBoundary.jsx';
import { AuthProvider } from '../features/auth/AuthContext.jsx';
import { CartProvider } from '../features/cart/CartContext.jsx';
import { WishlistProvider } from '../features/wishlist/WishlistContext.jsx';
import { SiteLayout } from './layout/SiteLayout.jsx';

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: http://localhost:5173/src/pages/ContactPage.jsx');

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function Boom({ error }) {
  throw error;
}

describe('isChunkLoadError', () => {
  it('recognises page-download failures from different browsers and bundlers', () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true); // Firefox wording
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error('Loading chunk 7 failed.'), { name: 'ChunkLoadError' }))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});

describe('ErrorBoundary', () => {
  it('shows a recoverable message instead of a blank page when a page fails to download', () => {
    render(<ErrorBoundary><Boom error={chunkError()} /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('This page could not be loaded');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to home page' })).toHaveAttribute('href', '/');
  });

  it('shows a generic message for other render errors', () => {
    render(<ErrorBoundary><Boom error={new Error('kaboom')} /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('We hit a problem showing this page');
  });

  it('renders children normally when nothing fails', () => {
    render(<ErrorBoundary><p>all good</p></ErrorBoundary>);
    expect(screen.getByText('all good')).toBeInTheDocument();
  });
});

describe('lazyWithRetry', () => {
  it('retries a failed download once and succeeds', async () => {
    const load = vi.fn().mockRejectedValueOnce(chunkError()).mockResolvedValueOnce({ default: () => <p>loaded</p> });
    const Page = lazy(lazyWithRetry(load));
    render(<Page />);
    expect(await screen.findByText('loaded')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not retry unrelated errors', async () => {
    const load = vi.fn().mockRejectedValue(new Error('syntax error in module'));
    await expect(lazyWithRetry(load)()).rejects.toThrow('syntax error');
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('storefront layout resilience', () => {
  const Broken = lazy(() => Promise.reject(chunkError()));
  const Fine = () => <h1>Working page</h1>;

  it('keeps the header and footer when a page fails, and recovers on navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <AuthProvider><CartProvider><WishlistProvider>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="broken" element={<Broken />} />
            <Route path="shop" element={<Fine />} />
          </Route>
        </Routes>
        </WishlistProvider></CartProvider></AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('This page could not be loaded');
    // Navigation and footer are still usable, so the visitor is never stranded on a blank screen.
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('link', { name: 'Shop' })[0]);
    expect(await screen.findByRole('heading', { name: 'Working page' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
