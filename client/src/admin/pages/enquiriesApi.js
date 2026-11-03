import { apiFetch } from '../../api/client.js';

const qs = (params) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') s.set(k, v);
  const t = s.toString();
  return t ? `?${t}` : '';
};

export const api = {
  list: (params, signal) => apiFetch(`/admin/enquiries${qs(params)}`, { signal }),
  setStatus: (id, status) => apiFetch(`/admin/enquiries/${id}`, { method: 'PATCH', body: { status } }),
  remove: (id) => apiFetch(`/admin/enquiries/${id}`, { method: 'DELETE' }),
};
