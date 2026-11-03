/**
 * Maps API validation details ("body.price", "body.specifications.0.items.1.label") to
 * { fieldName: message }. Keys keep everything after the "body." prefix.
 */
export function fieldErrorsFromApi(error) {
  const errors = {};
  for (const detail of error?.details ?? []) {
    const key = String(detail.path ?? '').replace(/^(body|query|params)\./, '');
    if (key && !errors[key]) errors[key] = detail.message;
  }
  return errors;
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 10;

/** Splits picked files into those we can upload and human-readable reasons for the rest. */
export function checkImageFiles(files, { slotsLeft = MAX_IMAGES } = {}) {
  const accepted = [];
  const rejected = [];
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) rejected.push(`${file.name}: only JPEG, PNG or WebP images are allowed.`);
    else if (file.size > MAX_IMAGE_BYTES) rejected.push(`${file.name}: larger than 5 MB.`);
    else if (accepted.length >= slotsLeft) rejected.push(`${file.name}: image limit reached (${MAX_IMAGES} per product).`);
    else accepted.push(file);
  }
  return { accepted, rejected };
}
