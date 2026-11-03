import { Brand } from '../models/Brand.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginationMeta } from '../utils/query.js';
import { uniqueSlug } from '../utils/slug.js';
import { removeImageFiles, storeImages } from './image.service.js';

const COLLATION = { locale: 'en', strength: 2 };

async function list(Model, { page, limit, q, active }) {
  const filter = {};
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
  if (active !== undefined) filter.isActive = active;

  const [items, total] = await Promise.all([
    Model.find(filter)
      .sort({ ...(Model === Category && { sortOrder: 1 }), name: 1 })
      .collation(COLLATION)
      .skip((page - 1) * limit)
      .limit(limit),
    Model.countDocuments(filter),
  ]);
  return { items, pagination: paginationMeta(total, page, limit) };
}

async function withProductCounts(items, field) {
  const counts = await Product.aggregate([
    { $match: { [field]: { $in: items.map((i) => i._id) } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  return items.map((item) => ({ ...item.toJSON(), productCount: byId.get(String(item._id)) ?? 0 }));
}

async function findOr404(Model, id, label) {
  const doc = await Model.findById(id);
  if (!doc) throw new ApiError(404, `${label} not found.`);
  return doc;
}

// ---------- Categories ----------

export async function listCategories(query) {
  const { items, pagination } = await list(Category, query);
  return { items: await withProductCounts(items, 'category'), pagination };
}

export const getCategory = (id) => findOr404(Category, id, 'Category');

async function assertValidParent(parentId, selfId) {
  if (!parentId) return;
  if (selfId && String(parentId) === String(selfId)) throw new ApiError(400, 'A category cannot be its own parent.');
  const parent = await Category.findById(parentId);
  if (!parent) throw new ApiError(400, 'Parent category does not exist.');
  if (parent.parent) throw new ApiError(400, 'Categories can only be nested one level deep.');
  if (selfId && (await Category.exists({ parent: selfId }))) {
    throw new ApiError(400, 'This category has sub-categories, so it cannot become a sub-category itself.');
  }
}

export async function createCategory(data) {
  await assertValidParent(data.parent);
  return Category.create({ ...data, slug: await uniqueSlug(Category, data.name) });
}

export async function updateCategory(id, data) {
  const category = await findOr404(Category, id, 'Category');
  if (data.parent !== undefined) await assertValidParent(data.parent, category._id);
  category.set(data);
  return category.save();
}

export async function deleteCategory(id) {
  const category = await findOr404(Category, id, 'Category');
  const [products, children] = await Promise.all([
    Product.countDocuments({ category: id }),
    Category.countDocuments({ parent: id }),
  ]);
  if (products > 0) {
    throw new ApiError(409, `This category has ${products} product(s). Move or delete them first, or mark the category inactive instead.`);
  }
  if (children > 0) throw new ApiError(409, 'This category has sub-categories. Delete or move them first.');
  await category.deleteOne();
  if (category.image) await removeImageFiles(category.image);
}

export async function setCategoryImage(id, file) {
  const category = await findOr404(Category, id, 'Category');
  const [stored] = await storeImages([file]);

  const previous = category.image?.toObject();
  category.image = stored;
  try {
    await category.save();
  } catch (error) {
    await removeImageFiles(stored);
    throw error;
  }
  if (previous) await removeImageFiles(previous);
  return category;
}

export async function removeCategoryImage(id) {
  const category = await findOr404(Category, id, 'Category');
  const previous = category.image?.toObject();
  category.image = undefined;
  await category.save();
  if (previous) await removeImageFiles(previous);
  return category;
}

// ---------- Brands ----------

export async function listBrands(query) {
  const { items, pagination } = await list(Brand, query);
  return { items: await withProductCounts(items, 'brand'), pagination };
}

export const getBrand = (id) => findOr404(Brand, id, 'Brand');

export async function createBrand(data) {
  return Brand.create({ ...data, slug: await uniqueSlug(Brand, data.name) });
}

export async function updateBrand(id, data) {
  const brand = await findOr404(Brand, id, 'Brand');
  brand.set(data);
  return brand.save();
}
