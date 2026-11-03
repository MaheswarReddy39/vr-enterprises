import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch } from '../../api/client.js';
import { business as defaults } from '../../config/business.js';

// Business details come from the saved store settings (Admin > Store settings). Until they load, or if a
// field was never saved, the placeholders from config/business.js are shown, never invented details.
const listeners = new Set();
let current = defaults;
let started = false;

const merge = (s) => ({
  ...defaults,
  name: s.name || defaults.name,
  tagline: s.tagline || '',
  logo: s.logo ?? null,
  contact: {
    phone: s.phone || defaults.contact.phone,
    email: s.email || defaults.contact.email,
    address: s.address || defaults.contact.address,
    hours: s.hours || defaults.contact.hours,
  },
});

const publish = (settings) => {
  current = merge(settings);
  listeners.forEach((l) => l());
};

export function loadBusiness() {
  return apiFetch('/store/settings', { auth: false })
    .then(({ settings }) => publish(settings))
    .catch(() => {});
}

/** Called after the admin saves settings so the open site shows them immediately. */
export const setBusinessSettings = publish;

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Same shape as config/business.js plus `logo` and `tagline`. */
export function useBusiness() {
  useEffect(() => {
    if (started) return;
    started = true;
    loadBusiness();
  }, []);
  return useSyncExternalStore(subscribe, () => current);
}

/** Test helper: forget what was loaded so the next render fetches again. */
export function resetBusiness() {
  started = false;
  current = defaults;
}
