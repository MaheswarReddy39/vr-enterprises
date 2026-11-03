import { MAX_STOCK, PRODUCT_STATUS } from '../constants/catalog.js';
import { InventoryLog } from '../models/InventoryLog.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta } from '../utils/query.js';

/**
 * Stock adjustment + its history entry. The guard conditions live inside the update itself (one atomic write),
 * so concurrent "remove" requests can never push stock below zero. The history entry is written right after;
 * if that fails the stock change is reversed so stock and history stay consistent.
 */
export async function adjustStock(productId, { type, quantity, reason, note }, user) {
  {
    const filter = { _id: productId };
    let update;

    if (type === 'add') {
      filter.stock = { $lte: MAX_STOCK - quantity };
      update = { $inc: { stock: quantity } };
    } else if (type === 'remove') {
      filter.stock = { $gte: quantity };
      update = { $inc: { stock: -quantity } };
    } else {
      update = { $set: { stock: quantity } };
    }

    const before = await Product.findOneAndUpdate(filter, update, { new: false });
    if (!before) {
      const product = await Product.findById(productId).select('stock');
      if (!product) throw new ApiError(404, 'Product not found.');
      throw new ApiError(
        409,
        type === 'remove'
          ? `Cannot remove ${quantity}: only ${product.stock} in stock.`
          : `Stock cannot exceed ${MAX_STOCK.toLocaleString('en-IN')}.`,
      );
    }

    const balanceAfter = type === 'add' ? before.stock + quantity : type === 'remove' ? before.stock - quantity : quantity;
    let log;
    try {
      [log] = await InventoryLog.create([
        {
          product: before._id,
          productName: before.name,
          sku: before.sku,
          type,
          delta: balanceAfter - before.stock,
          balanceAfter,
          reason,
          note,
          performedBy: user._id,
        },
      ]);
    } catch (error) {
      // Undo the stock change so no stock moves without a history entry.
      const undo = type === 'set' ? { filter: { _id: productId, stock: quantity }, update: { $set: { stock: before.stock } } } : { filter: { _id: productId }, update: { $inc: { stock: -(balanceAfter - before.stock) } } };
      await Product.updateOne(undo.filter, undo.update).catch((e) => console.error('Stock undo failed:', e.message));
      throw error;
    }

    return { productId: before._id, stock: balanceAfter, previousStock: before.stock, log };
  }
}

export async function listLogs({ page, limit, product }) {
  const filter = product ? { product } : {};
  const [items, total] = await Promise.all([
    InventoryLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('performedBy', 'name'),
    InventoryLog.countDocuments(filter),
  ]);
  return { items, pagination: paginationMeta(total, page, limit) };
}

/** Counts for the dashboard and inventory alerts. Archived products are excluded from stock alerts. */
export async function summary() {
  const active = { status: { $ne: PRODUCT_STATUS.ARCHIVED } };
  const [byStatus, featured, low, out] = await Promise.all([
    Product.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.countDocuments({ isFeatured: true, status: PRODUCT_STATUS.PUBLISHED }),
    Product.countDocuments({
      ...active,
      $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] },
    }),
    Product.countDocuments({ ...active, stock: 0 }),
  ]);
  const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
  return {
    products: {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      published: counts.published ?? 0,
      draft: counts.draft ?? 0,
      archived: counts.archived ?? 0,
      featured,
    },
    inventory: { low, out },
  };
}
