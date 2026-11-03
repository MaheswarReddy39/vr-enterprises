import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

brandSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Brand = mongoose.models.Brand ?? mongoose.model('Brand', brandSchema);
