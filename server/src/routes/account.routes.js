import { Router } from 'express';
import * as a from '../controllers/account.controller.js';
import * as o from '../controllers/booking.controller.js';
import { authenticate } from '../middleware/auth.js';
import { addressBody, addressParams, addressUpdateBody, bookingBody, bookingListQuery } from '../validators/booking.validators.js';
import { idParams } from '../validators/common.js';
import { validate } from '../middleware/validate.js';
import {
  cartItemBody,
  cartItemParams,
  cartMergeBody,
  changePasswordBody,
  profileBody,
  wishlistMergeBody,
} from '../validators/customer.validators.js';

const router = Router();

// Everything here belongs to the signed-in user. The user id always comes from the verified token.
router.use(authenticate);

router.get('/me', a.me);
router.patch('/me', validate({ body: profileBody }), a.updateProfile);
router.post('/change-password', validate({ body: changePasswordBody }), a.changePassword);

router.get('/cart', a.getCart);
router.post('/cart/merge', validate({ body: cartMergeBody }), a.mergeCart);
router.put('/cart/items/:productId', validate({ params: cartItemParams, body: cartItemBody }), a.setCartItem);
router.delete('/cart/items/:productId', validate({ params: cartItemParams }), a.removeCartItem);
router.delete('/cart', a.clearCart);

router.get('/wishlist', a.getWishlist);
router.post('/wishlist/merge', validate({ body: wishlistMergeBody }), a.mergeWishlist);
router.put('/wishlist/:productId', validate({ params: cartItemParams }), a.addWishlist);
router.delete('/wishlist/:productId', validate({ params: cartItemParams }), a.removeWishlist);

// Delivery addresses
router.get('/addresses', o.listAddresses);
router.post('/addresses', validate({ body: addressBody }), o.addAddress);
router.patch('/addresses/:addressId', validate({ params: addressParams, body: addressUpdateBody }), o.updateAddress);
router.delete('/addresses/:addressId', validate({ params: addressParams }), o.deleteAddress);

// Bookings: the user id always comes from the verified token, and every read is scoped to it
router.post('/bookings', validate({ body: bookingBody }), o.create);
router.get('/bookings', validate({ query: bookingListQuery }), o.listMine);
router.get('/bookings/:id', validate({ params: idParams }), o.getMine);

export default router;
