import { apiFetch } from './client.js';

const qs = (params = {}) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, v);
  const t = s.toString();
  return t ? `?${t}` : '';
};

// Saved delivery addresses
export const listAddresses = (signal) => apiFetch('/account/addresses', { signal });
export const addAddress = (body) => apiFetch('/account/addresses', { method: 'POST', body });
export const updateAddress = (id, body) => apiFetch(`/account/addresses/${id}`, { method: 'PATCH', body });
export const deleteAddress = (id) => apiFetch(`/account/addresses/${id}`, { method: 'DELETE' });

// Customer bookings
export const createBooking = (body) => apiFetch('/account/bookings', { method: 'POST', body });
export const listMyBookings = (params, signal) => apiFetch(`/account/bookings${qs(params)}`, { signal });
export const getMyBooking = (id, signal) => apiFetch(`/account/bookings/${id}`, { signal });

// Admin
export const listBookings = (params, signal) => apiFetch(`/admin/bookings${qs(params)}`, { signal });
export const getBooking = (id, signal) => apiFetch(`/admin/bookings/${id}`, { signal });
export const getUnreadCount = (signal) => apiFetch('/admin/bookings/unread-count', { signal });
export const setBookingRead = (id, isRead) => apiFetch(`/admin/bookings/${id}/read`, { method: 'PATCH', body: { isRead } });
export const markAllBookingsRead = () => apiFetch('/admin/bookings/read-all', { method: 'POST' });
export const setBookingStatus = (id, body) => apiFetch(`/admin/bookings/${id}/status`, { method: 'PATCH', body });

// WhatsApp notification log (admin)
export const listNotifications = (params, signal) => apiFetch(`/admin/notifications${qs(params)}`, { signal });
export const retryNotification = (id) => apiFetch(`/admin/notifications/${id}/retry`, { method: 'POST' });
