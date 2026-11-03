import { Banner } from '../models/Banner.js';
import { ApiError } from '../utils/ApiError.js';
import { removeImageFiles, storeImages } from './image.service.js';

const findOr404 = async (id) => {
  const banner = await Banner.findById(id);
  if (!banner) throw new ApiError(404, 'Banner not found.');
  return banner;
};

// ---------- Public ----------

/** Active banners inside their schedule window that have a picture, in display order. */
export async function listPublicBanners(now = new Date()) {
  const banners = await Banner.find({
    isActive: true,
    'image.fileId': { $exists: true },
    $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }],
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .limit(6);

  return banners.map((b) => ({
    id: String(b._id),
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.ctaLabel,
    linkUrl: b.linkUrl,
    image: { url: b.image.url, thumbUrl: b.image.thumbUrl, width: b.image.width, height: b.image.height },
  }));
}

// ---------- Admin ----------

export const listBanners = () => Banner.find().sort({ sortOrder: 1, createdAt: 1 });

export async function createBanner(data) {
  const last = await Banner.findOne().sort({ sortOrder: -1 }).select('sortOrder');
  return Banner.create({ ...data, sortOrder: (last?.sortOrder ?? -1) + 1 });
}

export async function updateBanner(id, data) {
  const banner = await findOr404(id);
  banner.set(data);
  return banner.save();
}

export async function deleteBanner(id) {
  const banner = await findOr404(id);
  await banner.deleteOne();
  if (banner.image) await removeImageFiles(banner.image);
}

export async function setBannerImage(id, file) {
  const banner = await findOr404(id);
  const [stored] = await storeImages([file]);
  const previous = banner.image?.toObject();
  banner.image = stored;
  try {
    await banner.save();
  } catch (error) {
    await removeImageFiles(stored);
    throw error;
  }
  if (previous) await removeImageFiles(previous);
  return banner;
}

export async function removeBannerImage(id) {
  const banner = await findOr404(id);
  const previous = banner.image?.toObject();
  banner.image = undefined;
  await banner.save();
  if (previous) await removeImageFiles(previous);
  return banner;
}

/** Persists a new display order. `order` must list every banner exactly once. */
export async function reorderBanners(order) {
  const existing = (await Banner.find().select('_id')).map((b) => String(b._id));
  const ok = order.length === existing.length && new Set(order).size === order.length && order.every((id) => existing.includes(id));
  if (!ok) throw new ApiError(400, 'The order must list every banner exactly once.');
  await Banner.bulkWrite(order.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: index } } } })));
  return listBanners();
}
