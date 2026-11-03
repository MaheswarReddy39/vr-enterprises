import sharp from 'sharp';
import {
  IMAGE_MAX_DIMENSION,
  IMAGE_MAX_PIXELS,
  IMAGE_QUALITY,
  IMAGE_THUMB_DIMENSION,
} from '../constants/catalog.js';
import { ApiError } from '../utils/ApiError.js';
import { deleteFiles, saveFile } from './gridfs.service.js';

const fit = (size) => ({ width: size, height: size, fit: 'inside', withoutEnlargement: true });

/**
 * Decodes the upload (which also proves it is a real image, beyond the magic-byte check), fixes
 * orientation, strips metadata such as GPS/EXIF, and produces an optimised WebP plus a thumbnail.
 */
async function processImage(buffer) {
  try {
    const source = sharp(buffer, { limitInputPixels: IMAGE_MAX_PIXELS, failOn: 'error' }).rotate();
    const [main, thumb] = await Promise.all([
      source.clone().resize(fit(IMAGE_MAX_DIMENSION)).webp({ quality: IMAGE_QUALITY }).toBuffer({ resolveWithObject: true }),
      source.clone().resize(fit(IMAGE_THUMB_DIMENSION)).webp({ quality: 75 }).toBuffer(),
    ]);
    return { main: main.data, thumb, width: main.info.width, height: main.info.height };
  } catch {
    throw new ApiError(400, 'This file could not be read as an image. It may be corrupted.');
  }
}

const safeName = (name) => String(name ?? 'image').replace(/[^\w.\- ]+/g, '_').slice(0, 200);

/**
 * Optimises and stores uploaded files in GridFS. All-or-nothing: if any file fails, everything already
 * written for this call is removed. Returns image metadata objects ready to embed in a document.
 */
export async function storeImages(files) {
  const written = [];
  try {
    // allSettled (not all): every upload must finish before we decide, otherwise a slow file could
    // still be written after cleanup ran and be left behind as an orphan.
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const processed = await processImage(file.buffer);
        const originalName = safeName(file.originalname);
        const fileId = await saveFile(processed.main, {
          filename: `${originalName}.webp`,
          contentType: 'image/webp',
          metadata: { kind: 'image', originalName },
        });
        written.push(fileId);
        const thumbFileId = await saveFile(processed.thumb, {
          filename: `${originalName}.thumb.webp`,
          contentType: 'image/webp',
          metadata: { kind: 'thumbnail', originalName },
        });
        written.push(thumbFileId);
        return {
          fileId,
          thumbFileId,
          width: processed.width,
          height: processed.height,
          size: processed.main.length,
          mimeType: 'image/webp',
          originalName,
        };
      }),
    );
    const failure = results.find((r) => r.status === 'rejected');
    if (failure) throw failure.reason;
    return results.map((r) => r.value);
  } catch (error) {
    await deleteFiles(written);
    if (error instanceof ApiError) throw error;
    console.error('Image storage failed:', error?.message);
    throw new ApiError(500, 'The image could not be saved. Please try again.');
  }
}

export const fileIdsOf = (...images) => images.flatMap((i) => [i?.fileId, i?.thumbFileId]).filter(Boolean);

export const removeImageFiles = (...images) => deleteFiles(fileIdsOf(...images));
