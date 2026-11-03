import { apiFetch } from './client.js';

// Customer sign-up / sign-in
export const register = (body) => apiFetch('/auth/register', { method: 'POST', body, auth: false });

// Profile
export const updateProfile = (body) => apiFetch('/account/me', { method: 'PATCH', body });
export const changePassword = (body) => apiFetch('/account/change-password', { method: 'POST', body });

// Account cart (signed-in)
export const getCart = (signal) => apiFetch('/account/cart', { signal });
export const setCartItem = (productId, quantity) => apiFetch(`/account/cart/items/${productId}`, { method: 'PUT', body: { quantity } });
export const removeCartItem = (productId) => apiFetch(`/account/cart/items/${productId}`, { method: 'DELETE' });
export const clearCart = () => apiFetch('/account/cart', { method: 'DELETE' });
export const mergeCart = (items) => apiFetch('/account/cart/merge', { method: 'POST', body: { items } });

// Guest cart pricing (public)
export const quoteCart = (items, signal) => apiFetch('/store/cart/quote', { method: 'POST', body: { items }, auth: false, signal });

// Wishlist
export const getWishlist = (signal) => apiFetch('/account/wishlist', { signal });
export const addWishlist = (productId) => apiFetch(`/account/wishlist/${productId}`, { method: 'PUT' });
export const removeWishlist = (productId) => apiFetch(`/account/wishlist/${productId}`, { method: 'DELETE' });
export const mergeWishlist = (ids) => apiFetch('/account/wishlist/merge', { method: 'POST', body: { ids } });
export const lookupProducts = (ids, signal) => apiFetch('/store/products/lookup', { method: 'POST', body: { ids }, auth: false, signal });

// Banners
export const listPublicBanners = (signal) => apiFetch('/store/banners', { signal, auth: false });
