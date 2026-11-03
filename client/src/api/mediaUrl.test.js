import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const load = async (base) => {
  vi.resetModules();
  if (base) vi.stubEnv('VITE_API_BASE_URL', base);
  return (await import('./client.js')).mediaUrl;
};

describe('mediaUrl', () => {
  it('keeps site-relative paths when the API is on the same origin (dev proxy)', async () => {
    const mediaUrl = await load('');
    expect(mediaUrl('/api/v1/media/abc')).toBe('/api/v1/media/abc');
  });

  it('prefixes the API origin when the API is on another domain', async () => {
    const mediaUrl = await load('https://api.example.com/api/v1');
    expect(mediaUrl('/api/v1/media/abc')).toBe('https://api.example.com/api/v1/media/abc');
  });

  it('leaves blob:, data: and absolute URLs alone', async () => {
    const mediaUrl = await load('https://api.example.com/api/v1');
    for (const url of ['blob:http://x/1', 'data:image/png;base64,AA', 'https://cdn.example.com/a.jpg']) {
      expect(mediaUrl(url)).toBe(url);
    }
    expect(mediaUrl(undefined)).toBeUndefined();
  });
});
