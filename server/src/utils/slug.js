export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'item';

/** Returns `base`, or `base-2`, `base-3`... whichever is free. The unique index remains the final guard. */
export async function uniqueSlug(Model, text, excludeId) {
  const base = slugify(text);
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await Model.exists({ slug: candidate, ...(excludeId && { _id: { $ne: excludeId } }) });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}
