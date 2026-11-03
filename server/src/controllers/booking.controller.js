import * as addresses from '../services/address.service.js';
import * as bookings from '../services/booking.service.js';
import * as notifications from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });

// ---------- customer: saved addresses ----------
export const listAddresses = asyncHandler(async (req, res) => ok(res, { addresses: await addresses.listAddresses(req.user._id) }));
export const addAddress = asyncHandler(async (req, res) => ok(res, { addresses: await addresses.addAddress(req.user._id, req.valid.body) }, 201));
export const updateAddress = asyncHandler(async (req, res) => ok(res, { addresses: await addresses.updateAddress(req.user._id, req.valid.params.addressId, req.valid.body) }));
export const deleteAddress = asyncHandler(async (req, res) => ok(res, { addresses: await addresses.deleteAddress(req.user._id, req.valid.params.addressId) }));

// ---------- customer: bookings (always scoped to the signed-in user) ----------
export const create = asyncHandler(async (req, res) => ok(res, { booking: bookings.toCustomerView(await bookings.createBooking(req.user, req.valid.body)) }, 201));
export const listMine = asyncHandler(async (req, res) => ok(res, await bookings.listMine(req.user._id, req.valid.query)));
export const getMine = asyncHandler(async (req, res) => ok(res, { booking: await bookings.getMine(req.user._id, req.valid.params.id) }));

// ---------- admin ----------
export const listAll = asyncHandler(async (req, res) => ok(res, await bookings.listAdmin(req.valid.query)));
export const unreadCount = asyncHandler(async (_req, res) => ok(res, { unreadCount: await bookings.unreadCount() }));
export const getAny = asyncHandler(async (req, res) => ok(res, { booking: bookings.toAdminView(await bookings.getAdmin(req.valid.params.id)) }));
export const listNotifications = asyncHandler(async (req, res) => ok(res, await notifications.listNotifications(req.valid.query)));
export const retryNotification = asyncHandler(async (req, res) => ok(res, { notification: await notifications.retryNotification(req.valid.params.id) }));
export const setRead = asyncHandler(async (req, res) => ok(res, { booking: bookings.toAdminView(await bookings.setRead(req.valid.params.id, req.valid.body.isRead)) }));
export const markAllRead = asyncHandler(async (_req, res) => ok(res, { updated: await bookings.markAllRead() }));
export const setStatus = asyncHandler(async (req, res) => ok(res, { booking: bookings.toAdminView(await bookings.updateStatus(req.user, req.valid.params.id, req.valid.body)) }));
