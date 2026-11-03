// Prices are stored as plain numbers; the store currency is INR. If the business
// ever needs another currency, change it here only.
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const number = new Intl.NumberFormat('en-IN');

// A price of 0 means the owner has not entered a price yet: shown as "Price on request", never as a free product.
export const formatPrice = (value) => (value == null ? '-' : value === 0 ? 'Price on request' : currency.format(value));
/** Totals are "To be confirmed" when nothing is priced, or when any line has no price yet. */
export const formatTotal = (value, hasUnpriced = false) => (value == null || value <= 0 || hasUnpriced ? 'To be confirmed' : currency.format(value));
export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '-');
export const formatNumber = (value) => number.format(value ?? 0);
