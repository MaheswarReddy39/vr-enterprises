import { Settings } from '../models/Settings.js';
import { removeImageFiles, storeImages } from './image.service.js';

export const getSettings = () => Settings.findOneAndUpdate({ key: 'store' }, { $setOnInsert: { key: 'store' } }, { upsert: true, new: true });

/** Full settings for the admin (includes GSTIN). */
export const toAdminSettings = (s) => {
  const o = s.toJSON();
  delete o._id;
  delete o.__v;
  delete o.key;
  return o;
};

/** What visitors may see: no GSTIN. */
export const toPublicSettings = (s) => ({
  name: s.business.name,
  tagline: s.business.tagline,
  address: s.business.address,
  phone: s.business.phone,
  email: s.business.email,
  hours: s.business.hours,
  logo: s.business.logo?.fileId ? { url: s.business.logo.url, thumbUrl: s.business.logo.thumbUrl } : null,
});

export async function updateSettings(data) {
  const $set = {};
  for (const [section, values] of Object.entries(data)) {
    for (const [key, value] of Object.entries(values ?? {})) $set[`${section}.${key}`] = value;
  }
  return Settings.findOneAndUpdate({ key: 'store' }, { $set }, { new: true, runValidators: true });
}

export async function setLogo(file) {
  const current = await getSettings();
  const [stored] = await storeImages([file]);
  const previous = current.business.logo?.toObject?.();
  current.business.logo = stored;
  try {
    await current.save();
  } catch (error) {
    await removeImageFiles(stored);
    throw error;
  }
  if (previous?.fileId) await removeImageFiles(previous);
  return current;
}

export async function removeLogo() {
  const current = await getSettings();
  const previous = current.business.logo?.toObject?.();
  current.business.logo = undefined;
  await current.save();
  if (previous?.fileId) await removeImageFiles(previous);
  return current;
}

