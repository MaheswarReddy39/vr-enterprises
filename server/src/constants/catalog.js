export const PRODUCT_STATUS = Object.freeze({ DRAFT: 'draft', PUBLISHED: 'published', ARCHIVED: 'archived' });
export const PRODUCT_STATUS_VALUES = Object.values(PRODUCT_STATUS);

export const MAX_IMAGES_PER_PRODUCT = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

export const MAX_STOCK = 1_000_000;
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export const STOCK_ADJUSTMENT_TYPES = ['add', 'remove', 'set'];
// "sale" is reserved for automatic deductions when orders are built; it is not a manual choice.
export const STOCK_REASONS = ['restock', 'return', 'damage', 'correction', 'other'];
export const INVENTORY_LOG_TYPES = ['initial', 'add', 'remove', 'set', 'sale'];

// Images are stored in MongoDB GridFS, converted to WebP, and served by /api/v1/media/:id.
export const IMAGE_BUCKET = 'images';
export const IMAGE_MAX_DIMENSION = 1600;
export const IMAGE_THUMB_DIMENSION = 480;
export const IMAGE_QUALITY = 82;
export const IMAGE_MAX_PIXELS = 40_000_000; // decompression-bomb guard
