import * as customers from '../services/customer.service.js';
import { dashboardStats } from '../services/dashboard.service.js';
import * as settings from '../services/settings.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });

export const stats = asyncHandler(async (_req, res) => ok(res, await dashboardStats()));

export const listCustomers = asyncHandler(async (req, res) => ok(res, await customers.listCustomers(req.valid.query)));
export const getCustomer = asyncHandler(async (req, res) => ok(res, { customer: await customers.getCustomer(req.valid.params.id) }));
export const setCustomerStatus = asyncHandler(async (req, res) =>
  ok(res, { customer: await customers.setCustomerActive(req.valid.params.id, req.valid.body.isActive) }));

export const getSettings = asyncHandler(async (_req, res) => ok(res, { settings: settings.toAdminSettings(await settings.getSettings()) }));
export const updateSettings = asyncHandler(async (req, res) => ok(res, { settings: settings.toAdminSettings(await settings.updateSettings(req.valid.body)) }));
export const setLogo = asyncHandler(async (req, res) => ok(res, { settings: settings.toAdminSettings(await settings.setLogo(req.file)) }));
export const removeLogo = asyncHandler(async (_req, res) => ok(res, { settings: settings.toAdminSettings(await settings.removeLogo()) }));

export const publicSettings = asyncHandler(async (_req, res) => ok(res, { settings: settings.toPublicSettings(await settings.getSettings()) }));
