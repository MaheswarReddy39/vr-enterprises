import * as account from '../services/account.service.js';
import * as cart from '../services/cart.service.js';
import * as wishlist from '../services/wishlist.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sessionResponse, setRefreshCookie } from './auth.controller.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const cartResponse = (res, data) => ok(res, { cart: data });

export const me = (req, res) => ok(res, { user: req.user.toJSON() });
export const updateProfile = asyncHandler(async (req, res) => ok(res, { user: (await account.updateProfile(req.user._id, req.valid.body)).toJSON() }));

export const changePassword = asyncHandler(async (req, res) => {
  const session = await account.changePassword(req.user._id, req.valid.body);
  setRefreshCookie(res, session.refreshToken);
  res.json(sessionResponse(session));
});

// Cart: every handler acts on the signed-in user's own cart only (the id comes from the token, never the request).
export const getCart = asyncHandler(async (req, res) => cartResponse(res, await cart.getCart(req.user._id)));
export const setCartItem = asyncHandler(async (req, res) =>
  cartResponse(res, await cart.setItem(req.user._id, req.valid.params.productId, req.valid.body.quantity)));
export const removeCartItem = asyncHandler(async (req, res) => cartResponse(res, await cart.setItem(req.user._id, req.valid.params.productId, 0)));
export const clearCart = asyncHandler(async (req, res) => cartResponse(res, await cart.clearCart(req.user._id)));
export const mergeCart = asyncHandler(async (req, res) => cartResponse(res, await cart.mergeCart(req.user._id, req.valid.body.items)));

export const getWishlist = asyncHandler(async (req, res) => ok(res, await wishlist.getWishlist(req.user._id)));
export const addWishlist = asyncHandler(async (req, res) => ok(res, await wishlist.addProduct(req.user._id, req.valid.params.productId)));
export const removeWishlist = asyncHandler(async (req, res) => ok(res, await wishlist.removeProduct(req.user._id, req.valid.params.productId)));
export const mergeWishlist = asyncHandler(async (req, res) => ok(res, await wishlist.mergeProducts(req.user._id, req.valid.body.ids)));
