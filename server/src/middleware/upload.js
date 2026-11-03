import multer from 'multer';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES_PER_PRODUCT } from '../constants/catalog.js';
import { ApiError } from '../utils/ApiError.js';
import { detectImageType } from '../utils/imageSniff.js';

const parser = multer({
  storage: multer.memoryStorage(), // nothing is written to the server's disk
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES_PER_PRODUCT, fields: 10, parts: MAX_IMAGES_PER_PRODUCT + 10 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, `"${file.originalname}" is not a supported image. Use JPEG, PNG or WebP.`));
    }
    cb(null, true);
  },
});

function verifyContents(req, _res, next) {
  const files = req.files ?? (req.file ? [req.file] : []);
  if (files.length === 0) return next(new ApiError(400, 'No image was uploaded.'));
  for (const file of files) {
    // The declared type passed the filter; the actual bytes must agree.
    if (detectImageType(file.buffer) !== file.mimetype) {
      return next(new ApiError(400, `"${file.originalname}" is not a valid ${file.mimetype} image.`));
    }
  }
  next();
}

export const uploadImages = (field = 'images') => [parser.array(field, MAX_IMAGES_PER_PRODUCT), verifyContents];
export const uploadSingleImage = (field = 'image') => [parser.single(field), verifyContents];
