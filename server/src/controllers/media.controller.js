import { findFile, openDownload } from '../services/gridfs.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const SERVED_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const STREAM_HEADERS = ['Content-Type', 'Content-Length', 'Cache-Control', 'ETag'];

/**
 * Public image delivery. File ids are unguessable and never reused, so responses are immutable and
 * cacheable for a year. Only image types are ever served from this bucket.
 */
export const serveMedia = asyncHandler(async (req, res, next) => {
  const { id } = req.valid.params;
  const file = await findFile(id);
  if (!file || !SERVED_TYPES.includes(file.contentType)) throw new ApiError(404, 'Image not found.');

  const etag = `"${id}"`;
  if (req.headers['if-none-match'] === etag) return res.status(304).end();

  res.set({
    'Content-Type': file.contentType,
    'Content-Length': String(file.length),
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    // Helmet defaults to same-origin; the storefront may live on a different domain than the API.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });

  const stream = openDownload(id);
  stream.once('error', (error) => {
    console.error(`Image ${id} could not be streamed:`, error.message);
    if (res.headersSent) return res.destroy();
    STREAM_HEADERS.forEach((h) => res.removeHeader(h));
    next(new ApiError(404, 'Image not found.'));
  });
  stream.pipe(res);
});
