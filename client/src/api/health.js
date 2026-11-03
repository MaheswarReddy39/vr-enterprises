import { apiFetch } from './client.js';

export const getHealth = (signal) => apiFetch('/health', { signal });
