import * as categories from '../services/category.service.js';
import * as inventory from '../services/inventory.service.js';
import * as products from '../services/product.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });

// ---------- Categories ----------
export const listCategories = asyncHandler(async (req, res) => ok(res, await categories.listCategories(req.valid.query)));
export const getCategory = asyncHandler(async (req, res) => ok(res, { category: await categories.getCategory(req.valid.params.id) }));
export const createCategory = asyncHandler(async (req, res) => ok(res, { category: await categories.createCategory(req.valid.body) }, 201));
export const updateCategory = asyncHandler(async (req, res) =>
  ok(res, { category: await categories.updateCategory(req.valid.params.id, req.valid.body) }));
export const deleteCategory = asyncHandler(async (req, res) => {
  await categories.deleteCategory(req.valid.params.id);
  ok(res, {});
});
export const setCategoryImage = asyncHandler(async (req, res) =>
  ok(res, { category: await categories.setCategoryImage(req.valid.params.id, req.file) }));
export const removeCategoryImage = asyncHandler(async (req, res) =>
  ok(res, { category: await categories.removeCategoryImage(req.valid.params.id) }));

// ---------- Brands ----------
export const listBrands = asyncHandler(async (req, res) => ok(res, await categories.listBrands(req.valid.query)));
export const getBrand = asyncHandler(async (req, res) => ok(res, { brand: await categories.getBrand(req.valid.params.id) }));
export const createBrand = asyncHandler(async (req, res) => ok(res, { brand: await categories.createBrand(req.valid.body) }, 201));
export const updateBrand = asyncHandler(async (req, res) =>
  ok(res, { brand: await categories.updateBrand(req.valid.params.id, req.valid.body) }));

// ---------- Products ----------
export const listProducts = asyncHandler(async (req, res) => ok(res, await products.listProducts(req.valid.query)));
export const getProduct = asyncHandler(async (req, res) => ok(res, { product: await products.getProduct(req.valid.params.id) }));
export const createProduct = asyncHandler(async (req, res) =>
  ok(res, { product: await products.createProduct(req.valid.body, req.user) }, 201));
export const updateProduct = asyncHandler(async (req, res) =>
  ok(res, { product: await products.updateProduct(req.valid.params.id, req.valid.body, req.user) }));
export const deleteProduct = asyncHandler(async (req, res) => {
  await products.deleteProduct(req.valid.params.id);
  ok(res, {});
});
export const addImages = asyncHandler(async (req, res) =>
  ok(res, { product: await products.addImages(req.valid.params.id, req.files) }, 201));
export const removeImage = asyncHandler(async (req, res) =>
  ok(res, { product: await products.removeImage(req.valid.params.id, req.valid.params.imageId) }));
export const reorderImages = asyncHandler(async (req, res) =>
  ok(res, { product: await products.reorderImages(req.valid.params.id, req.valid.body.order) }));
export const setPrimaryImage = asyncHandler(async (req, res) =>
  ok(res, { product: await products.setPrimaryImage(req.valid.params.id, req.valid.params.imageId) }));

// ---------- Inventory ----------
export const adjustStock = asyncHandler(async (req, res) =>
  ok(res, await inventory.adjustStock(req.valid.params.id, req.valid.body, req.user)));
export const listInventoryLogs = asyncHandler(async (req, res) => ok(res, await inventory.listLogs(req.valid.query)));
export const dashboardSummary = asyncHandler(async (_req, res) => ok(res, await inventory.summary()));
