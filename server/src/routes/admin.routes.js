import { Router } from 'express';
import { ROLES } from '../constants/roles.js';
import * as c from '../controllers/catalog.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadImages, uploadSingleImage } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParams, imageParams } from '../validators/common.js';
import {
  brandCreateBody,
  brandListQuery,
  brandUpdateBody,
  categoryCreateBody,
  categoryListQuery,
  categoryUpdateBody,
} from '../validators/category.validators.js';
import * as bannerCtl from '../controllers/banner.controller.js';
import * as adminCtl from '../controllers/admin.controller.js';
import * as bookingCtl from '../controllers/booking.controller.js';
import * as storeCtl from '../controllers/store.controller.js';
import { bannerCreateBody, bannerOrderBody, bannerUpdateBody } from '../validators/banner.validators.js';
import { customerListQuery, customerStatusBody } from '../validators/admin.validators.js';
import { settingsBody } from '../validators/settings.validators.js';
import { adminBookingListQuery, bookingStatusBody, notificationListQuery, readBody } from '../validators/booking.validators.js';
import { adjustStockBody, inventoryLogQuery } from '../validators/inventory.validators.js';
import { adminEnquiryListQuery, enquiryStatusBody } from '../validators/store.validators.js';
import {
  imageOrderBody,
  productCreateBody,
  productListQuery,
  productUpdateBody,
} from '../validators/product.validators.js';

const router = Router();
const adminOnly = requireRole(ROLES.ADMIN);

// Every route below requires a valid token AND an admin/staff role. This single guard is applied
// before any route is registered, so a new endpoint cannot accidentally be left public.
router.use(authenticate, requireRole(ROLES.ADMIN, ROLES.STAFF));

router.get('/dashboard/summary', c.dashboardSummary);
router.get('/dashboard/stats', adminCtl.stats);

// Customers: staff may look, only admins may change an account's status
router.get('/customers', validate({ query: customerListQuery }), adminCtl.listCustomers);
router.get('/customers/:id', validate({ params: idParams }), adminCtl.getCustomer);
router.patch('/customers/:id/status', adminOnly, validate({ params: idParams, body: customerStatusBody }), adminCtl.setCustomerStatus);

// Store settings: administrators only (business details and logo)
router.get('/settings', adminOnly, adminCtl.getSettings);
router.put('/settings', adminOnly, validate({ body: settingsBody }), adminCtl.updateSettings);
router.put('/settings/logo', adminOnly, uploadSingleImage('image'), adminCtl.setLogo);
router.delete('/settings/logo', adminOnly, adminCtl.removeLogo);

// Categories
router.get('/categories', validate({ query: categoryListQuery }), c.listCategories);
router.post('/categories', validate({ body: categoryCreateBody }), c.createCategory);
router.get('/categories/:id', validate({ params: idParams }), c.getCategory);
router.patch('/categories/:id', validate({ params: idParams, body: categoryUpdateBody }), c.updateCategory);
router.delete('/categories/:id', adminOnly, validate({ params: idParams }), c.deleteCategory);
router.put('/categories/:id/image', validate({ params: idParams }), uploadSingleImage('image'), c.setCategoryImage);
router.delete('/categories/:id/image', validate({ params: idParams }), c.removeCategoryImage);

// Brands
router.get('/brands', validate({ query: brandListQuery }), c.listBrands);
router.post('/brands', validate({ body: brandCreateBody }), c.createBrand);
router.get('/brands/:id', validate({ params: idParams }), c.getBrand);
router.patch('/brands/:id', validate({ params: idParams, body: brandUpdateBody }), c.updateBrand);

// Products
router.get('/products', validate({ query: productListQuery }), c.listProducts);
router.post('/products', validate({ body: productCreateBody }), c.createProduct);
router.get('/products/:id', validate({ params: idParams }), c.getProduct);
router.patch('/products/:id', validate({ params: idParams, body: productUpdateBody }), c.updateProduct);
router.delete('/products/:id', adminOnly, validate({ params: idParams }), c.deleteProduct);

// Product images. `/images/order` is registered before `/images/:imageId` routes so it is not read as an id.
router.post('/products/:id/images', validate({ params: idParams }), uploadImages('images'), c.addImages);
router.put('/products/:id/images/order', validate({ params: idParams, body: imageOrderBody }), c.reorderImages);
router.patch('/products/:id/images/:imageId/primary', validate({ params: imageParams }), c.setPrimaryImage);
router.delete('/products/:id/images/:imageId', validate({ params: imageParams }), c.removeImage);

// Inventory
router.get('/inventory/logs', validate({ query: inventoryLogQuery }), c.listInventoryLogs);
router.post('/inventory/:id/adjust', validate({ params: idParams, body: adjustStockBody }), c.adjustStock);

// Homepage banners (`/banners/order` is registered before the `:id` routes)
router.get('/banners', bannerCtl.list);
router.post('/banners', validate({ body: bannerCreateBody }), bannerCtl.create);
router.put('/banners/order', validate({ body: bannerOrderBody }), bannerCtl.reorder);
router.patch('/banners/:id', validate({ params: idParams, body: bannerUpdateBody }), bannerCtl.update);
router.delete('/banners/:id', adminOnly, validate({ params: idParams }), bannerCtl.remove);
router.put('/banners/:id/image', validate({ params: idParams }), uploadSingleImage('image'), bannerCtl.setImage);
router.delete('/banners/:id/image', validate({ params: idParams }), bannerCtl.removeImage);

// Bookings (static paths are registered before the :id routes)
router.get('/bookings', validate({ query: adminBookingListQuery }), bookingCtl.listAll);
router.get('/bookings/unread-count', bookingCtl.unreadCount);
router.post('/bookings/read-all', bookingCtl.markAllRead);
router.get('/bookings/:id', validate({ params: idParams }), bookingCtl.getAny);
router.patch('/bookings/:id/read', validate({ params: idParams, body: readBody }), bookingCtl.setRead);
// WhatsApp notification log and retries
router.get('/notifications', validate({ query: notificationListQuery }), bookingCtl.listNotifications);
router.post('/notifications/:id/retry', validate({ params: idParams }), bookingCtl.retryNotification);
router.patch('/bookings/:id/status', validate({ params: idParams, body: bookingStatusBody }), bookingCtl.setStatus);

// Enquiries submitted from the storefront contact form
router.get('/enquiries', validate({ query: adminEnquiryListQuery }), storeCtl.listEnquiries);
router.patch('/enquiries/:id', validate({ params: idParams, body: enquiryStatusBody }), storeCtl.setEnquiryStatus);
router.delete('/enquiries/:id', adminOnly, validate({ params: idParams }), storeCtl.deleteEnquiry);

export default router;
