import mongoose from 'mongoose';
import { PRODUCT_STATUS } from '../constants/catalog.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginationMeta } from '../utils/query.js';

// Public storefront data access. Everything here is read-only and returns an explicit allow-list of
// fields (never raw documents), so admin-only data (createdBy, exact stock, thresholds...) cannot leak.

const MAX_ORDER_QUANTITY = 10;

const SORTS = {
  featured: { isFeatured: -1, createdAt: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  name: { name: 1, _id: 1 },
};

const COLLATION = { locale: 'en', strength: 2 };

const availabilityOf = (p) => (p.stock <= 0 ? 'out_of_stock' : p.stock <= p.lowStockThreshold ? 'low_stock' : 'in_stock');

const publicImage = (i) => ({ id: String(i._id), url: i.url, thumbUrl: i.thumbUrl, width: i.width, height: i.height, alt: i.alt ?? '' });

function publicImages(product) {
  const primary = product.images.find((i) => i.isPrimary) ?? product.images[0];
  const ordered = primary ? [primary, ...product.images.filter((i) => i !== primary)] : [];
  return ordered.map(publicImage);
}

export function toPublicProduct(p, { detail = false } = {}) {
  const images = publicImages(p);
  const result = {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    shortDescription: p.shortDescription,
    price: p.price,
    mrp: p.mrp != null && p.mrp > p.price ? p.mrp : null,
    discountPercent: p.mrp != null && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : null,
    isFeatured: p.isFeatured,
    // Sample products are flagged so the storefront can label them clearly.
    isDemo: p.sku.startsWith('DEMO-'),
    availability: availabilityOf(p),
    // A product with no price entered yet can never be added to a cart or booked, whatever its stock.
    maxQuantity: p.price > 0 ? Math.min(Math.max(p.stock, 0), MAX_ORDER_QUANTITY) : 0,
    bookable: p.price > 0 && p.stock > 0,
    category: p.category?.name ? { name: p.category.name, slug: p.category.slug } : null,
    brand: p.brand?.isActive ? { name: p.brand.name, slug: p.brand.slug } : null,
    primaryImage: images[0] ?? null,
    images: detail ? images : images.slice(0, 2),
  };
  if (detail) {
    result.description = p.description;
    result.features = p.features;
    result.specifications = p.specifications.map((g) => ({
      group: g.group,
      items: g.items.map((i) => ({ label: i.label, value: i.value })),
    }));
  }
  return result;
}

const POPULATE = [
  { path: 'category', select: 'name slug' },
  { path: 'brand', select: 'name slug isActive' },
];

const activeCategories = () => Category.find({ isActive: true }).select('_id parent slug name description image sortOrder');

/** Published products whose category is active. The status and category rules live here, once. */
async function visibleFilter() {
  const cats = await activeCategories();
  return { cats, filter: { status: PRODUCT_STATUS.PUBLISHED, category: { $in: cats.map((c) => c._id) } } };
}

export async function listProducts({ page, limit, q, category, featured, sort }) {
  const { cats, filter } = await visibleFilter();

  if (category) {
    const match = cats.find((c) => c.slug === category || String(c._id) === category);
    if (!match) return { items: [], pagination: paginationMeta(0, page, limit), category: null };
    const ids = [match._id, ...cats.filter((c) => String(c.parent) === String(match._id)).map((c) => c._id)];
    filter.category = { $in: ids };
  }
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { shortDescription: rx }, { sku: rx }];
  }
  if (featured !== undefined) filter.isFeatured = featured;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .select('-description -specifications -features -createdBy -updatedBy -__v')
      .populate(POPULATE)
      .sort(SORTS[sort])
      .collation(COLLATION)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  const matched = category ? cats.find((c) => c.slug === category || String(c._id) === category) : null;
  return {
    items: items.map((p) => toPublicProduct(p)),
    pagination: paginationMeta(total, page, limit),
    category: matched ? { name: matched.name, slug: matched.slug } : null,
  };
}

async function findVisibleByKey(key) {
  const { filter } = await visibleFilter();
  const isId = /^[a-f0-9]{24}$/i.test(key);
  const product = await Product.findOne({ ...filter, ...(isId ? { _id: key } : { slug: key.toLowerCase() }) })
    .select('-createdBy -updatedBy -__v')
    .populate(POPULATE);
  if (!product) throw new ApiError(404, 'Product not found.');
  return product;
}

/** Visible (published, active-category) products for a list of ids; ids that are not visible are simply absent. */
export async function visibleProductsByIds(ids) {
  const valid = [...new Set(ids.map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return [];
  const { filter } = await visibleFilter();
  return Product.find({ ...filter, _id: { $in: valid } })
    .select('-description -specifications -features -createdBy -updatedBy -__v')
    .populate(POPULATE);
}

/** Public product data for the given ids, in the order requested. */
export async function lookupProducts(ids) {
  const found = await visibleProductsByIds(ids);
  const order = new Map(ids.map((id, i) => [String(id), i]));
  return found.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id))).map((p) => toPublicProduct(p));
}

export async function getProduct(key) {
  return toPublicProduct(await findVisibleByKey(key), { detail: true });
}

export async function relatedProducts(key, limit) {
  const product = await findVisibleByKey(key);
  const { filter } = await visibleFilter();
  const base = { ...filter, _id: { $ne: product._id } };
  const select = '-description -specifications -features -createdBy -updatedBy -__v';

  const sameCategory = await Product.find({ ...base, category: product.category._id }).select(select).populate(POPULATE).sort(SORTS.featured).limit(limit);
  let items = sameCategory;
  if (items.length < limit) {
    // Top up with other published products so the section is never needlessly empty.
    const have = [product._id, ...items.map((i) => i._id)];
    const more = await Product.find({ ...filter, _id: { $nin: have } }).select(select).populate(POPULATE).sort(SORTS.featured).limit(limit - items.length);
    items = [...items, ...more];
  }
  return items.map((p) => toPublicProduct(p));
}

export async function listCategories() {
  const cats = await activeCategories();
  const counts = await Product.aggregate([
    { $match: { status: PRODUCT_STATUS.PUBLISHED, category: { $in: cats.map((c) => c._id) } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const own = new Map(counts.map((c) => [String(c._id), c.count]));
  const total = (c) =>
    (own.get(String(c._id)) ?? 0) +
    cats.filter((k) => String(k.parent) === String(c._id)).reduce((sum, k) => sum + (own.get(String(k._id)) ?? 0), 0);

  return cats
    .map((c) => ({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image?.fileId ? { url: c.image.url, thumbUrl: c.image.thumbUrl } : null,
      parent: c.parent ? cats.find((k) => String(k._id) === String(c.parent))?.slug ?? null : null,
      productCount: total(c),
      sortOrder: c.sortOrder,
    }))
    .filter((c) => c.productCount > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(({ sortOrder, ...rest }) => rest);
}

export const isValidObjectId = (id) => mongoose.isValidObjectId(id);
