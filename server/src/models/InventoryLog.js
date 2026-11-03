import mongoose from 'mongoose';
import { INVENTORY_LOG_TYPES } from '../constants/catalog.js';

const inventoryLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Snapshots keep the history readable even if the product is later renamed or deleted.
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    type: { type: String, enum: INVENTORY_LOG_TYPES, required: true },
    delta: { type: Number, required: true }, // signed change
    balanceAfter: { type: Number, required: true },
    reason: { type: String, default: 'other' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

inventoryLogSchema.index({ product: 1, createdAt: -1 });
inventoryLogSchema.index({ createdAt: -1 });

export const InventoryLog = mongoose.models.InventoryLog ?? mongoose.model('InventoryLog', inventoryLogSchema);
