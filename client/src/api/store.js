import { apiFetch } from './client.js';

const qs = (params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

// Public storefront endpoints: no credentials are sent and nothing here can return unpublished data.
const publicGet = (path, signal) => apiFetch(path, { signal, auth: false });

export const listStoreProducts = (params, signal) => publicGet(`/store/products${qs(params)}`, signal);
export const getStoreProduct = (slug, signal) => publicGet(`/store/products/${encodeURIComponent(slug)}`, signal);
export const listRelatedProducts = (slug, signal) => publicGet(`/store/products/${encodeURIComponent(slug)}/related`, signal);
export const listStoreCategories = (signal) => publicGet('/store/categories', signal);
export const submitEnquiry = (body) => apiFetch('/store/enquiries', { method: 'POST', body, auth: false });
