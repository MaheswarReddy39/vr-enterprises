import mongoose from 'mongoose';
import { makeImageSchema } from './imageSchema.js';

// Homepage banners managed by admins. The picture lives in GridFS like every other image.
const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    subtitle: { type: String, trim: true, maxlength: 200, default: '' },
    ctaLabel: { type: String, trim: true, maxlength: 30, default: '' },
    // Internal path ("/shop?category=...") or an https URL; validated in validators/banner.validators.js.
    linkUrl: { type: String, trim: true, maxlength: 300, default: '' },
    image: { type: makeImageSchema({ withId: false, product: false }), default: undefined },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Banner = mongoose.models.Banner ?? mongoose.model('Banner', bannerSchema);
