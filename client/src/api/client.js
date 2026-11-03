// The API base URL is public configuration. Secrets never belong in frontend code.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

// Image URLs come from the API as site-relative paths (/api/v1/media/:id). When the API lives on another
// origin (VITE_API_BASE_URL is absolute) they must be prefixed with that origin.
const API_ORIGIN = BASE_URL.startsWith('http') ? new URL(BASE_URL).origin : '';
export const mediaUrl = (path) => (path?.startsWith('/') ? `${API_ORIGIN}${path}` : path);

export class ApiClientError extends Error {
  constructor(message, { status = 0, details } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

// The access token lives only in memory (never localStorage), so XSS cannot read it from storage and a
// page reload simply gets a fresh one from the httpOnly refresh cookie.
let accessToken = null;
let onAuthLost = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const setAuthLostHandler = (handler) => {
  onAuthLost = handler;
};

let refreshing = null;

/** Single-flight: concurrent callers share one refresh request (refresh tokens are single-use). */
export function refreshAccessToken() {
  refreshing ??= fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new ApiClientError(data?.message ?? 'Session expired.', { status: response.status });
      accessToken = data.accessToken;
      return data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function recoverFromUnauthorized() {
  try {
    await refreshAccessToken();
    return true;
  } catch {
    accessToken = null;
    onAuthLost();
    return false;
  }
}

const toError = (data, status) =>
  new ApiClientError(data?.message ?? `Request failed (${status}).`, { status, details: data?.details });

export async function apiFetch(path, { method = 'GET', body, signal, headers, auth = true, blob = false } = {}, retried = false) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body && !isForm && { 'Content-Type': 'application/json' }),
        ...(auth && accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...headers,
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiClientError('Cannot reach the server. Check your connection and try again.');
  }

  // `blob: true` is for file downloads; errors are still JSON.
  const data = blob && response.ok ? await response.blob() : await response.json().catch(() => null);
  if (response.status === 401 && auth && !retried && (await recoverFromUnauthorized())) {
    return apiFetch(path, { method, body, signal, headers, auth, blob }, true);
  }
  if (!response.ok) throw toError(data, response.status);
  return data;
}

/** multipart upload with progress (fetch cannot report upload progress, XHR can). */
export function apiUpload(path, formData, { method = 'POST', onProgress, signal } = {}, retried = false) {
  const send = () =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, `${BASE_URL}${path}`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept', 'application/json');
      if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => reject(new ApiClientError('Upload failed. Check your connection and try again.'));
      xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          // non-JSON error body
        }
        resolve({ status: xhr.status, data });
      };
      signal?.addEventListener('abort', () => xhr.abort());
      xhr.send(formData);
    });

  return send().then(async ({ status, data }) => {
    if (status === 401 && !retried && (await recoverFromUnauthorized())) {
      return apiUpload(path, formData, { method, onProgress, signal }, true);
    }
    if (status < 200 || status >= 300) throw toError(data, status);
    return data;
  });
}
