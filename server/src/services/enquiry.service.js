import { PRODUCT_STATUS } from '../constants/catalog.js';
import { Enquiry } from '../models/Enquiry.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta } from '../utils/query.js';

export async function createEnquiry({ website, product, ...data }) {
  // Honeypot filled in = a bot. Pretend success, store nothing.
  if (website) return { saved: false };

  let productInfo = {};
  if (product) {
    // Only published products can be referenced from the public form.
    const found = await Product.findOne({ _id: product, status: PRODUCT_STATUS.PUBLISHED }).select('name');
    if (found) productInfo = { product: found._id, productName: found.name };
  }
  await Enquiry.create({ ...data, ...productInfo });
  return { saved: true };
}

export async function listEnquiries({ page, limit, status }) {
  const filter = status ? { status } : {};
  const [items, total, unread] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Enquiry.countDocuments(filter),
    Enquiry.countDocuments({ status: 'new' }),
  ]);
  return { items, pagination: paginationMeta(total, page, limit), unread };
}

export async function setEnquiryStatus(id, status) {
  const enquiry = await Enquiry.findByIdAndUpdate(id, { status }, { new: true });
  if (!enquiry) throw new ApiError(404, 'Enquiry not found.');
  return enquiry;
}

export async function deleteEnquiry(id) {
  const result = await Enquiry.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw new ApiError(404, 'Enquiry not found.');
}
