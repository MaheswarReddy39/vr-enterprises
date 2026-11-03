import * as banners from '../services/banner.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });

export const listPublic = asyncHandler(async (_req, res) => ok(res, { items: await banners.listPublicBanners() }));

export const list = asyncHandler(async (_req, res) => ok(res, { items: await banners.listBanners() }));
export const create = asyncHandler(async (req, res) => ok(res, { banner: await banners.createBanner(req.valid.body) }, 201));
export const update = asyncHandler(async (req, res) => ok(res, { banner: await banners.updateBanner(req.valid.params.id, req.valid.body) }));
export const remove = asyncHandler(async (req, res) => {
  await banners.deleteBanner(req.valid.params.id);
  ok(res, {});
});
export const setImage = asyncHandler(async (req, res) => ok(res, { banner: await banners.setBannerImage(req.valid.params.id, req.file) }));
export const removeImage = asyncHandler(async (req, res) => ok(res, { banner: await banners.removeBannerImage(req.valid.params.id) }));
export const reorder = asyncHandler(async (req, res) => ok(res, { items: await banners.reorderBanners(req.valid.body.order) }));
