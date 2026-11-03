import { PRODUCT_STATUS } from '../constants/catalog.js';
import { ROLES } from '../constants/roles.js';
import { BOOKING_STATUS, Booking } from '../models/Booking.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { toAdminView } from './booking.service.js';
import { failedCount } from './notification.service.js';

/** Dashboard figures: bookings by status, unread "new booking" alerts, customers, products and the latest bookings. */
export async function dashboardStats() {
  const [byStatus, unread, unreadList, recent, customers, activeCustomers, published, failedMessages] = await Promise.all([
    Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.countDocuments({ isRead: false }),
    Booking.find({ isRead: false }).sort({ createdAt: -1 }).limit(5),
    Booking.find().sort({ createdAt: -1 }).limit(5),
    User.countDocuments({ role: ROLES.CUSTOMER }),
    User.countDocuments({ role: ROLES.CUSTOMER, isActive: true }),
    Product.countDocuments({ status: PRODUCT_STATUS.PUBLISHED }),
    failedCount(),
  ]);
  const count = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));

  return {
    bookings: {
      total: Object.values(count).reduce((a, b) => a + b, 0),
      ...Object.fromEntries(BOOKING_STATUS.map((s) => [s, count[s] ?? 0])),
      unread,
    },
    newBookings: unreadList.map(toAdminView),
    customers: { total: customers, active: activeCustomers },
    products: { published },
    notifications: { failed: failedMessages },
    recentBookings: recent.map(toAdminView),
  };
}
