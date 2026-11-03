import * as cart from '../services/cart.service.js';
import * as enquiries from '../services/enquiry.service.js';
import * as store from '../services/store.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });

// ---------- Public ----------
export const listCategories = asyncHandler(async (_req, res) => ok(res, { items: await store.listCategories() }));
export const listProducts = asyncHandler(async (req, res) => ok(res, await store.listProducts(req.valid.query)));
export const getProduct = asyncHandler(async (req, res) => ok(res, { product: await store.getProduct(req.valid.params.key) }));
export const relatedProducts = asyncHandler(async (req, res) =>
  ok(res, { items: await store.relatedProducts(req.valid.params.key, req.valid.query.limit) }));

export const createEnquiry = asyncHandler(async (req, res) => {
  await enquiries.createEnquiry(req.valid.body);
  ok(res, { message: 'Thank you. Your enquiry has been received and we will get back to you.' }, 201);
});

export const lookupProducts = asyncHandler(async (req, res) => ok(res, { items: await store.lookupProducts(req.valid.body.ids) }));
export const quoteCart = asyncHandler(async (req, res) => ok(res, { cart: await cart.quote(req.valid.body.items) }));

// ---------- Admin (mounted behind the admin guard) ----------
export const listEnquiries = asyncHandler(async (req, res) => ok(res, await enquiries.listEnquiries(req.valid.query)));
export const setEnquiryStatus = asyncHandler(async (req, res) =>
  ok(res, { enquiry: await enquiries.setEnquiryStatus(req.valid.params.id, req.valid.body.status) }));
export const deleteEnquiry = asyncHandler(async (req, res) => {
  await enquiries.deleteEnquiry(req.valid.params.id);
  ok(res, {});
});
