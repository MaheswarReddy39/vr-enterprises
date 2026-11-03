import mongoose from 'mongoose';

export const ENQUIRY_STATUS = ['new', 'read', 'resolved'];

// Contact / product enquiries submitted from the public storefront.
const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    // Snapshot of the product the visitor asked about (if any), so it stays readable if the product changes.
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, trim: true, maxlength: 200 },
    status: { type: String, enum: ENQUIRY_STATUS, default: 'new', index: true },
  },
  { timestamps: true },
);

enquirySchema.index({ createdAt: -1 });

export const Enquiry = mongoose.models.Enquiry ?? mongoose.model('Enquiry', enquirySchema);
