import { apiFetch, apiUpload } from './client.js';

const qs = (params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

const json = (method, body) => ({ method, body });

// Auth
export const login = (email, password) => apiFetch('/auth/login', { ...json('POST', { email, password }), auth: false });
export const logout = () => apiFetch('/auth/logout', { method: 'POST', auth: false });

// Dashboard
export const getSummary = (signal) => apiFetch('/admin/dashboard/summary', { signal });

// Categories
export const listCategories = (params, signal) => apiFetch(`/admin/categories${qs(params)}`, { signal });
export const createCategory = (body) => apiFetch('/admin/categories', json('POST', body));
export const updateCategory = (id, body) => apiFetch(`/admin/categories/${id}`, json('PATCH', body));
export const deleteCategory = (id) => apiFetch(`/admin/categories/${id}`, { method: 'DELETE' });
export const uploadCategoryImage = (id, file, onProgress) => {
  const form = new FormData();
  form.append('image', file);
  return apiUpload(`/admin/categories/${id}/image`, form, { method: 'PUT', onProgress });
};
export const removeCategoryImage = (id) => apiFetch(`/admin/categories/${id}/image`, { method: 'DELETE' });

// Brands
export const listBrands = (params, signal) => apiFetch(`/admin/brands${qs(params)}`, { signal });
export const createBrand = (body) => apiFetch('/admin/brands', json('POST', body));
export const updateBrand = (id, body) => apiFetch(`/admin/brands/${id}`, json('PATCH', body));

// Products
export const listProducts = (params, signal) => apiFetch(`/admin/products${qs(params)}`, { signal });
export const getProduct = (id, signal) => apiFetch(`/admin/products/${id}`, { signal });
export const createProduct = (body) => apiFetch('/admin/products', json('POST', body));
export const updateProduct = (id, body) => apiFetch(`/admin/products/${id}`, json('PATCH', body));
export const deleteProduct = (id) => apiFetch(`/admin/products/${id}`, { method: 'DELETE' });

// Product images
export const uploadProductImages = (id, files, onProgress) => {
  const form = new FormData();
  files.forEach((file) => form.append('images', file));
  return apiUpload(`/admin/products/${id}/images`, form, { onProgress });
};
export const deleteProductImage = (id, imageId) => apiFetch(`/admin/products/${id}/images/${imageId}`, { method: 'DELETE' });
export const reorderProductImages = (id, order) => apiFetch(`/admin/products/${id}/images/order`, json('PUT', { order }));
export const setPrimaryImage = (id, imageId) => apiFetch(`/admin/products/${id}/images/${imageId}/primary`, { method: 'PATCH' });

// Homepage banners
export const listBanners = (signal) => apiFetch('/admin/banners', { signal });
export const createBanner = (body) => apiFetch('/admin/banners', json('POST', body));
export const updateBanner = (id, body) => apiFetch(`/admin/banners/${id}`, json('PATCH', body));
export const deleteBanner = (id) => apiFetch(`/admin/banners/${id}`, { method: 'DELETE' });
export const reorderBanners = (order) => apiFetch('/admin/banners/order', json('PUT', { order }));
export const uploadBannerImage = (id, file, onProgress) => {
  const form = new FormData();
  form.append('image', file);
  return apiUpload(`/admin/banners/${id}/image`, form, { method: 'PUT', onProgress });
};

// Inventory
export const adjustStock = (id, body) => apiFetch(`/admin/inventory/${id}/adjust`, json('POST', body));
export const listInventoryLogs = (params, signal) => apiFetch(`/admin/inventory/logs${qs(params)}`, { signal });

// Dashboard, customers and store settings
export const getStats = (signal) => apiFetch('/admin/dashboard/stats', { signal });
export const listCustomers = (params, signal) => apiFetch(`/admin/customers${qs(params)}`, { signal });
export const getCustomer = (id, signal) => apiFetch(`/admin/customers/${id}`, { signal });
export const setCustomerStatus = (id, isActive) => apiFetch(`/admin/customers/${id}/status`, json('PATCH', { isActive }));
export const getSettings = (signal) => apiFetch('/admin/settings', { signal });
export const saveSettings = (body) => apiFetch('/admin/settings', json('PUT', body));
export const uploadLogo = (file, onProgress) => {
  const form = new FormData();
  form.append('image', file);
  return apiUpload('/admin/settings/logo', form, { method: 'PUT', onProgress });
};
export const removeLogo = () => apiFetch('/admin/settings/logo', { method: 'DELETE' });
