import mongoose from 'mongoose';
import { makeImageSchema } from './imageSchema.js';

const { Schema } = mongoose;
const text = (max) => ({ type: String, trim: true, maxlength: max, default: '' });

// One document (key "store") holds the editable business details. Nothing here is pre-filled with business facts.
const settingsSchema = new Schema(
  {
    key: { type: String, default: 'store', unique: true },
    business: {
      name: { type: String, trim: true, maxlength: 100, default: 'VR Enterprises' },
      tagline: text(120),
      address: text(500),
      phone: text(30),
      email: text(254),
      hours: text(200),
      gstin: text(15),
      logo: { type: makeImageSchema({ withId: false, product: false }), default: undefined },
    },
  },
  { timestamps: true },
);

export const Settings = mongoose.models.Settings ?? mongoose.model('Settings', settingsSchema);
