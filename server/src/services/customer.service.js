import { ROLES } from '../constants/roles.js';
import { Booking } from '../models/Booking.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginationMeta } from '../utils/query.js';
import { toAdminView } from './booking.service.js';

// Only these fields are ever read: passwords, refresh tokens and lockout counters are never selected.
const SAFE_FIELDS = 'name email phone isActive createdAt addresses';

async function bookingStats(userIds) {
  const rows = await Booking.aggregate([{ $match: { user: { $in: userIds } } }, { $group: { _id: '$user', bookings: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), { bookings: r.bookings }]));
}

const view = (user, stats) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone ?? '',
  isActive: user.isActive,
  createdAt: user.createdAt,
  bookingCount: stats?.bookings ?? 0,
});

export async function listCustomers({ page, limit, q, status }) {
  const filter = { role: ROLES.CUSTOMER };
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).select(SAFE_FIELDS).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  const stats = await bookingStats(users.map((u) => u._id));
  return { items: users.map((u) => view(u, stats.get(String(u._id)))), pagination: paginationMeta(total, page, limit) };
}

async function findCustomer(id) {
  const user = await User.findOne({ _id: id, role: ROLES.CUSTOMER }).select(SAFE_FIELDS);
  if (!user) throw new ApiError(404, 'Customer not found.');
  return user;
}

export async function getCustomer(id) {
  const user = await findCustomer(id);
  const [stats, recent] = await Promise.all([bookingStats([user._id]), Booking.find({ user: user._id }).sort({ createdAt: -1 }).limit(10)]);
  return {
    ...view(user, stats.get(String(user._id))),
    addresses: user.addresses.map((a) => ({ id: String(a._id), label: a.label, name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, isDefault: a.isDefault })),
    recentBookings: recent.map(toAdminView),
  };
}

/** Deactivating blocks sign-in and API access immediately (tokens are checked against the database) and ends every session. */
export async function setCustomerActive(id, isActive) {
  const user = await findCustomer(id);
  const update = isActive ? { isActive } : { isActive, refreshTokens: [] };
  await User.updateOne({ _id: user._id }, { $set: update });
  return getCustomer(id);
}
