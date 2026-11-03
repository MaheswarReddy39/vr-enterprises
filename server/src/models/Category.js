import mongoose from 'mongoose';
import { makeImageSchema } from './imageSchema.js';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    image: {
      type: makeImageSchema({ withId: false, product: false }),
      default: undefined,
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Category = mongoose.models.Category ?? mongoose.model('Category', categorySchema);
