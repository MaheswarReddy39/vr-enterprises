import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MAX_IMAGES_PER_PRODUCT, PRODUCT_STATUS } from '../constants/catalog.js';
import { Brand } from '../models/Brand.js';
import { Category } from '../models/Category.js';
import { InventoryLog } from '../models/InventoryLog.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginationMeta } from '../utils/query.js';
import { uniqueSlug } from '../utils/slug.js';
import { removeImageFiles, storeImages } from './image.service.js';

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
  name: { name: 1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  stock_asc: { stock: 1 },
};

const POPULATE = [
  { path: 'category', select: 'name slug' },
  { path: 'brand', select: 'name slug' },
];

async function generateSku() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `VR-${crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase()}`;
    if (!(await Product.exists({ sku: candidate }))) return candidate;
  }
  throw new ApiError(500, 'Could not generate a unique SKU. Please enter one manually.');
}

async function assertReferences({ category, brand }) {
  if (category && !(await Category.exists({ _id: category }))) throw new ApiError(400, 'Selected category does not exist.');
  if (brand && !(await Brand.exists({ _id: brand }))) throw new ApiError(400, 'Selected brand does not exist.');
}

function assertPublishable(product) {
  if (product.status === PRODUCT_STATUS.PUBLISHED && product.images.length === 0) {
    throw new ApiError(400, 'Add at least one image before publishing this product.');
  }
  if (product.status === PRODUCT_STATUS.PUBLISHED && !(product.price > 0)) {
    throw new ApiError(400, 'Enter the selling price before publishing this product.', [{ path: 'body.price', message: 'Enter the selling price before publishing.' }]);
  }
}

async function findOr404(id) {
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, 'Product not found.');
  return product;
}

const populated = (id) => Product.findById(id).populate(POPULATE);

export async function listProducts({ page, limit, q, status, category, brand, featured, stock, sort }) {
  const filter = {};
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { sku: rx }];
  }
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (brand) filter.brand = brand;
  if (featured !== undefined) filter.isFeatured = featured;
  if (stock === 'out') filter.stock = 0;
  if (stock === 'low') filter.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
  if (stock === 'in') filter.$expr = { $gt: ['$stock', '$lowStockThreshold'] };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .select('-description -specifications -features')
      .populate(POPULATE)
      .sort({ ...SORTS[sort], _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);
  return { items, pagination: paginationMeta(total, page, limit) };
}

export async function getProduct(id) {
  const product = await populated(id);
  if (!product) throw new ApiError(404, 'Product not found.');
  return product;
}

export async function createProduct(data, user) {
  await assertReferences(data);
  const { stock = 0, sku, ...rest } = data;
  const finalSku = sku ?? (await generateSku());
  const slug = await uniqueSlug(Product, data.name);

  // The product is saved first, then its opening-stock entry; if the entry fails the product is removed again.
  const created = await (async () => {
    const product = new Product({ ...rest, stock, sku: finalSku, slug, createdBy: user._id, updatedBy: user._id });
    assertPublishable(product);
    await product.save();

    if (stock > 0) {
      try {
        await InventoryLog.create(
        [
          {
            product: product._id,
            productName: product.name,
            sku: product.sku,
            type: 'initial',
            delta: stock,
            balanceAfter: stock,
            reason: 'other',
            note: 'Initial stock',
            performedBy: user._id,
          },
        ],
        );
      } catch (error) {
        await Product.deleteOne({ _id: product._id }).catch(() => {});
        throw error;
      }
    }
    return product;
  })();
  return populated(created._id);
}

export async function updateProduct(id, data, user) {
  const product = await findOr404(id);
  await assertReferences(data);

  const price = data.price ?? product.price;
  const mrp = data.mrp !== undefined ? data.mrp : product.mrp;
  if (mrp != null && mrp < price) throw new ApiError(400, 'MRP cannot be lower than the selling price.', [{ path: 'body.mrp', message: 'MRP cannot be lower than the selling price.' }]);

  if (data.sku && data.sku !== product.sku && (await Product.exists({ sku: data.sku, _id: { $ne: product._id } }))) {
    throw new ApiError(409, 'A product with this SKU already exists.');
  }

  const { sku, ...rest } = data;
  product.set(rest);
  if (sku) product.sku = sku;
  product.updatedBy = user._id;
  assertPublishable(product);
  await product.save();
  return populated(product._id);
}

/** Permanent deletion. Prefer archiving (status "archived") for products that should only be hidden. */
export async function deleteProduct(id) {
  const product = await findOr404(id);
  await product.deleteOne();
  await removeImageFiles(...product.images); // also removes every GridFS file the product owned
}

// ---------- Images ----------

export async function addImages(id, files) {
  const product = await findOr404(id);
  if (product.images.length + files.length > MAX_IMAGES_PER_PRODUCT) {
    throw new ApiError(400, `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images (it has ${product.images.length}).`);
  }

  const stored = await storeImages(files);

  // The positional guard makes the limit atomic even if two uploads race.
  const updated = await Product.findOneAndUpdate(
    { _id: id, [`images.${MAX_IMAGES_PER_PRODUCT - stored.length}`]: { $exists: false } },
    { $push: { images: { $each: stored } } },
    { new: true },
  ).catch(async (error) => {
    await removeImageFiles(...stored);
    throw error;
  });

  if (!updated) {
    await removeImageFiles(...stored);
    throw new ApiError(409, `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images.`);
  }

  if (!updated.images.some((i) => i.isPrimary)) {
    await Product.updateOne({ _id: id }, { $set: { 'images.0.isPrimary': true } });
  }
  return getProduct(id);
}

export async function removeImage(id, imageId) {
  const product = await findOr404(id);
  const image = product.images.id(imageId);
  if (!image) throw new ApiError(404, 'Image not found.');
  if (product.status === PRODUCT_STATUS.PUBLISHED && product.images.length === 1) {
    throw new ApiError(409, 'A published product needs at least one image. Unpublish it first or add another image.');
  }

  const wasPrimary = image.isPrimary;
  const removed = image.toObject();
  image.deleteOne();
  if (wasPrimary && product.images.length > 0) product.images[0].isPrimary = true;
  await product.save();
  await removeImageFiles(removed);
  return getProduct(id);
}

export async function reorderImages(id, order) {
  const product = await findOr404(id);
  const existing = product.images.map((i) => String(i._id));
  const sameSet = order.length === existing.length && new Set(order).size === order.length && order.every((o) => existing.includes(o));
  if (!sameSet) throw new ApiError(400, 'The order must list every image of this product exactly once.');

  const byId = new Map(product.images.map((i) => [String(i._id), i.toObject()]));
  product.images = order.map((imageId) => byId.get(imageId));
  await product.save();
  return getProduct(id);
}

export async function setPrimaryImage(id, imageId) {
  const oid = new mongoose.Types.ObjectId(imageId);
  // Single pipeline update: exactly one image ends up primary, with no window where none/two are.
  const result = await Product.updateOne({ _id: id, 'images._id': oid }, [
    {
      $set: {
        images: {
          $map: {
            input: '$images',
            as: 'img',
            in: { $mergeObjects: ['$$img', { isPrimary: { $eq: ['$$img._id', oid] } }] },
          },
        },
      },
    },
  ]);
  if (result.matchedCount === 0) throw new ApiError(404, 'Image not found.');
  return getProduct(id);
}
