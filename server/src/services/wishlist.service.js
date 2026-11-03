import { Wishlist } from '../models/Wishlist.js';
import { ApiError } from '../utils/ApiError.js';
import { lookupProducts, visibleProductsByIds } from './store.service.js';

export const MAX_WISHLIST = 100;

const idsOf = (wishlist) => (wishlist?.products ?? []).map(String);

/** Public product data for the saved products that are still visible in the shop. */
export async function getWishlist(userId) {
  const items = await lookupProducts(idsOf(await Wishlist.findOne({ user: userId })));
  return { items, ids: items.map((p) => p.id) };
}

export async function addProduct(userId, productId) {
  const [product] = await visibleProductsByIds([productId]);
  if (!product) throw new ApiError(404, 'This product is not available.');
  const current = idsOf(await Wishlist.findOne({ user: userId }));
  if (current.length >= MAX_WISHLIST && !current.includes(String(productId))) {
    throw new ApiError(400, `A wishlist can hold at most ${MAX_WISHLIST} products.`);
  }
  await Wishlist.updateOne({ user: userId }, { $addToSet: { products: productId } }, { upsert: true });
  return getWishlist(userId);
}

export async function removeProduct(userId, productId) {
  await Wishlist.updateOne({ user: userId }, { $pull: { products: productId } });
  return getWishlist(userId);
}

export async function mergeProducts(userId, productIds) {
  const visible = await visibleProductsByIds(productIds);
  if (visible.length > 0) {
    await Wishlist.updateOne({ user: userId }, { $addToSet: { products: { $each: visible.map((p) => p._id) } } }, { upsert: true });
  }
  return getWishlist(userId);
}
