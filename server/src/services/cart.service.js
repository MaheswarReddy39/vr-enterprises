import { Cart } from '../models/Cart.js';
import { ApiError } from '../utils/ApiError.js';
import { toPublicProduct, visibleProductsByIds } from './store.service.js';

export const MAX_LINE_QUANTITY = 10;
export const MAX_CART_LINES = 20;

const paise = (price) => Math.round(price * 100);

/** Merges duplicate lines and clamps quantities to a sane range. */
function normalise(items) {
  const merged = new Map();
  for (const { productId, quantity } of items) {
    const key = String(productId);
    merged.set(key, Math.min((merged.get(key) ?? 0) + quantity, MAX_LINE_QUANTITY));
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Prices a list of { productId, quantity } from the catalogue. Prices, names and availability always come
 * from the database; quantities are reduced to what is in stock; unpublished or missing products come back
 * flagged `unavailable` so the cart can offer to remove them. Nothing the client sends affects a price.
 */
export async function quote(rawItems) {
  const items = normalise(rawItems);
  const products = await visibleProductsByIds(items.map((i) => i.productId));
  const byId = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  let itemCount = 0;
  const lines = items.map(({ productId, quantity }) => {
    const product = byId.get(productId);
    if (!product) return { productId, available: false, issue: 'unavailable', quantity, lineTotal: 0 };

    const pub = toPublicProduct(product);
    const soldOut = pub.maxQuantity === 0;
    const finalQuantity = soldOut ? quantity : Math.min(quantity, pub.maxQuantity);
    const lineTotal = soldOut ? 0 : (paise(pub.price) * finalQuantity) / 100;
    if (!soldOut) {
      subtotal += paise(pub.price) * finalQuantity;
      itemCount += finalQuantity;
    }
    return {
      productId: pub.id,
      slug: pub.slug,
      name: pub.name,
      sku: pub.sku,
      price: pub.price,
      mrp: pub.mrp,
      isDemo: pub.isDemo,
      image: pub.primaryImage ? { url: pub.primaryImage.url, thumbUrl: pub.primaryImage.thumbUrl } : null,
      quantity: finalQuantity,
      maxQuantity: pub.maxQuantity,
      availability: pub.availability,
      available: !soldOut,
      issue: soldOut ? 'out_of_stock' : finalQuantity < quantity ? 'quantity_reduced' : null,
      lineTotal,
    };
  });

  return { lines, itemCount, subtotal: subtotal / 100, currency: 'INR' };
}

const storedItems = (cart) => (cart?.items ?? []).map((i) => ({ productId: String(i.product), quantity: i.quantity }));

export async function getCart(userId) {
  return quote(storedItems(await Cart.findOne({ user: userId })));
}

const loadOrCreate = (userId) => Cart.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId } }, { upsert: true, new: true });

/** Sets the exact quantity of one product (0 removes it). */
export async function setItem(userId, productId, quantity) {
  const cart = await loadOrCreate(userId);
  const existing = cart.items.find((i) => String(i.product) === String(productId));

  if (quantity === 0) {
    if (existing) cart.items = cart.items.filter((i) => i !== existing);
  } else {
    const [product] = await visibleProductsByIds([productId]);
    if (!product) throw new ApiError(404, 'This product is not available.');
    const { maxQuantity } = toPublicProduct(product);
    if (maxQuantity === 0) throw new ApiError(409, 'This product is out of stock.');
    if (quantity > maxQuantity) {
      throw new ApiError(400, `Only ${maxQuantity} available.`, [{ path: 'body.quantity', message: `Only ${maxQuantity} available.` }]);
    }
    if (existing) existing.quantity = quantity;
    else {
      if (cart.items.length >= MAX_CART_LINES) throw new ApiError(400, `A cart can hold at most ${MAX_CART_LINES} different products.`);
      cart.items.push({ product: productId, quantity });
    }
  }
  await cart.save();
  return getCart(userId);
}

export async function clearCart(userId) {
  await Cart.updateOne({ user: userId }, { $set: { items: [] } });
  return getCart(userId);
}

/** Adds a guest cart's items into the account cart after sign-in, silently skipping anything unavailable. */
export async function mergeCart(userId, guestItems) {
  const cart = await loadOrCreate(userId);
  const wanted = normalise(guestItems);
  const products = await visibleProductsByIds(wanted.map((i) => i.productId));
  const max = new Map(products.map((p) => [String(p._id), toPublicProduct(p).maxQuantity]));

  for (const { productId, quantity } of wanted) {
    const limit = max.get(productId) ?? 0;
    if (limit === 0) continue;
    const existing = cart.items.find((i) => String(i.product) === productId);
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, limit, MAX_LINE_QUANTITY);
    else if (cart.items.length < MAX_CART_LINES) cart.items.push({ product: productId, quantity: Math.min(quantity, limit) });
  }
  await cart.save();
  return getCart(userId);
}
