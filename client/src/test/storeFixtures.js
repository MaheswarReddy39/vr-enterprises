import { vi } from 'vitest';

export const json = (status, body) => Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(body) });

const image = (id) => ({ id, url: `/api/v1/media/${id}`, thumbUrl: `/api/v1/media/t${id}`, width: 800, height: 800, alt: '' });

export const makeProduct = (overrides = {}) => ({
  id: 'p1',
  slug: 'alpha-purifier',
  name: 'Alpha Purifier',
  sku: 'ALP-001',
  shortDescription: 'A short description.',
  price: 12000,
  mrp: 15000,
  discountPercent: 20,
  isFeatured: false,
  isDemo: false,
  availability: 'in_stock',
  maxQuantity: 10,
  category: { name: 'Water', slug: 'water' },
  brand: null,
  primaryImage: image('a1'),
  images: [image('a1'), image('a2')],
  description: 'First paragraph.\n\nSecond paragraph.',
  features: ['Feature one'],
  specifications: [{ group: 'Details', items: [{ label: 'Capacity', value: '10 litres' }] }],
  ...overrides,
});

export const categories = [
  { id: 'c1', name: 'Water', slug: 'water', description: '', image: null, parent: null, productCount: 4 },
  { id: 'c2', name: 'Commercial', slug: 'commercial', description: '', image: null, parent: null, productCount: 2 },
];

/**
 * Fake API. `routes` maps "METHOD /path" (query string ignored) to a handler(url, init) returning a
 * json() promise. Returns the recorded calls so tests can assert on the exact query strings sent.
 */
export function mockApi(routes) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, init = {}) => {
      const path = String(url).replace(/^.*\/api\/v1/, '');
      const method = init.method ?? 'GET';
      calls.push({ method, path, query: new URLSearchParams(path.split('?')[1] ?? ''), body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers });
      const handler = routes[`${method} ${path.split('?')[0]}`];
      return handler ? handler(path, init) : json(404, { message: `unmocked ${method} ${path}` });
    }),
  );
  return calls;
}

export const page = (items, overrides = {}) => ({
  success: true,
  items,
  pagination: { page: 1, limit: 12, total: items.length, totalPages: 1, ...overrides },
});
