import mongoose from 'mongoose';
import { DEFAULT_LOW_STOCK_THRESHOLD, MAX_STOCK, PRODUCT_STATUS, PRODUCT_STATUS_VALUES } from '../constants/catalog.js';
import { makeImageSchema } from './imageSchema.js';

const { Schema } = mongoose;

// Fully admin-defined: groups and labels are free text, nothing is predefined.
const specItemSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false },
);
const specGroupSchema = new Schema(
  { group: { type: String, trim: true, maxlength: 80, default: '' }, items: { type: [specItemSchema], default: [] } },
  { _id: false },
);

const integer = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    brand: { type: Schema.Types.ObjectId, ref: 'Brand', default: null, index: true },
    shortDescription: { type: String, trim: true, maxlength: 300, default: '' },
    description: { type: String, trim: true, maxlength: 10000, default: '' },
    // Prices are in rupees with at most 2 decimals. They are only ever set by authenticated admins.
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0, default: null },
    images: { type: [makeImageSchema()], default: [] },
    specifications: { type: [specGroupSchema], default: [] },
    features: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
    // Stock changes only through the inventory service so every change is logged.
    stock: { type: Number, default: 0, min: 0, max: MAX_STOCK, validate: integer },
    // Booking IDs whose stock deduction has been applied to this product. It is written in the SAME atomic update as the
    // stock change, so after a crash we know exactly which items of an interrupted confirmation were really deducted.
    appliedBookings: { type: [String], default: [], select: false },
    lowStockThreshold: { type: Number, default: DEFAULT_LOW_STOCK_THRESHOLD, min: 0, validate: integer },
    status: { type: String, enum: PRODUCT_STATUS_VALUES, default: PRODUCT_STATUS.DRAFT, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

productSchema.index({ status: 1, createdAt: -1 });

productSchema.virtual('stockStatus').get(function stockStatus() {
  if (this.stock <= 0) return 'out';
  return this.stock <= this.lowStockThreshold ? 'low' : 'in';
});

productSchema.virtual('primaryImage').get(function primaryImage() {
  return this.images?.find((i) => i.isPrimary) ?? this.images?.[0] ?? null;
});

productSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

export const Product = mongoose.models.Product ?? mongoose.model('Product', productSchema);
