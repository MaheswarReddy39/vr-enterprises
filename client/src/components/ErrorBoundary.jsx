import { Component } from 'react';

const CHUNK_ERROR = /dynamically imported module|importing a module script failed|failed to fetch dynamically|ChunkLoadError|Loading chunk .* failed/i;
export const isChunkLoadError = (error) => CHUNK_ERROR.test(`${error?.name ?? ''} ${error?.message ?? ''}`);

const RELOAD_KEY = 'vr-chunk-reload-at';

/**
 * After a new deployment, a tab that is still open asks for page files that no longer exist. Reloading once
 * fetches the new build. The timestamp guard prevents a reload loop if the files are genuinely unreachable.
 */
function reloadOnceForNewDeployment() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/** React.lazy that retries a failed page download once, so a brief network blip never breaks navigation. */
export function lazyWithRetry(load) {
  return async function retrying() {
    try {
      return await load();
    } catch (first) {
      if (!isChunkLoadError(first)) throw first;
      await new Promise((resolve) => setTimeout(resolve, 400));
      return load();
    }
  };
}

/**
 * Catches rendering and page-loading errors so the visitor sees a message and a way forward instead of a
 * blank screen. `resetKey` (e.g. the pathname) clears the error when the visitor navigates elsewhere.
 * Uses plain markup/links so it keeps working even if routing or styling code is what failed.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Page error caught by ErrorBoundary:', error);
    if (import.meta.env.PROD && isChunkLoadError(error)) reloadOnceForNewDeployment();
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkLoadError(error);
    return (
      <div role="alert" className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">{chunk ? 'Page could not load' : 'Something went wrong'}</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">{chunk ? 'This page could not be loaded' : 'We hit a problem showing this page'}</h1>
        <p className="mt-4 text-muted">
          {chunk
            ? 'Your connection may have dropped, or the website was just updated. Reloading usually fixes it.'
            : 'Please try again. If it keeps happening, go back to the home page.'}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex h-11 items-center rounded-lg bg-brand-800 px-5 text-sm font-medium text-ivory hover:bg-brand-900">
            Reload page
          </button>
          <a href="/" className="inline-flex h-11 items-center rounded-lg border border-brand-800 px-5 text-sm font-medium text-brand-800 hover:bg-brand-50">
            Go to home page
          </a>
        </div>
      </div>
    );
  }
}
