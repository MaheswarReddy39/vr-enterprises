import mongoose from 'mongoose';

const { Schema } = mongoose;

export const NOTIFICATION_KINDS = ['admin_new_booking', 'customer_status'];
export const NOTIFICATION_STATES = ['pending', 'sending', 'sent', 'failed', 'skipped'];

// One row per WhatsApp message the system wants to send. It is the audit trail ("did the customer get told?") and the
// retry queue. A failed or skipped message never affects the booking itself.
const notificationSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    bookingId: { type: String, required: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    status: { type: String, default: '' }, // the booking status a customer message is about
    to: { type: String, default: '' }, // E.164 digits without "+", e.g. 919XXXXXXXXX ("" when the number was invalid)
    template: { type: String, required: true },
    params: { type: [String], default: [] },
    state: { type: String, enum: NOTIFICATION_STATES, default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' }, // sanitised: never contains the access token
    providerMessageId: String,
    sentAt: Date,
    lockedAt: Date, // set while a send is in progress so two requests can never send the same message
    // booking + kind (+ status): a UNIQUE key, so the same message is never created twice.
    dedupeKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

notificationSchema.index({ state: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);
