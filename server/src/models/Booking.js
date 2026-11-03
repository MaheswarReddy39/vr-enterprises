import mongoose from 'mongoose';

const { Schema } = mongoose;

export const BOOKING_STATUS = ['pending', 'confirmed', 'processing', 'completed', 'rejected'];

const itemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    // Snapshots: the booking keeps the name and displayed price from the moment it was made.
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 10 },
    lineTotal: { type: Number, required: true, min: 0 },
    imageThumbUrl: String,
  },
  { _id: false },
);

const bookingSchema = new Schema(
  {
    bookingId: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customer: { name: String, mobile: String, email: String },
    items: { type: [itemSchema], required: true },
    // Total of the displayed prices. No money is collected on the site.
    total: { type: Number, required: true, min: 0 },
    deliveryAddress: { line1: String, line2: String, city: String, state: String, postalCode: String },
    status: { type: String, enum: BOOKING_STATUS, default: 'pending', index: true },
    statusHistory: [{ _id: false, status: String, note: String, at: { type: Date, default: Date.now }, by: { type: Schema.Types.ObjectId, ref: 'User' } }],
    // "New booking" alerts: false until an admin/staff member opens it or marks it read.
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date,
    // Set exactly once, by an atomic claim, when the admin confirms and stock is deducted: the guard against double deduction.
    stockDeducted: { type: Boolean, default: false },
    // When the confirmation claimed this booking; a claim that is never finished is rolled back by recoverBookings().
    claimedAt: Date,
    // customer + items + 2-minute window. A UNIQUE index on it makes duplicate submissions impossible even when they
    // arrive at the same instant; it is removed as soon as the booking leaves Pending.
    dedupeKey: String,
  },
  { timestamps: true },
);

bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export const Booking = mongoose.models.Booking ?? mongoose.model('Booking', bookingSchema);
