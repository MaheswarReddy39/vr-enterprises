import mongoose from 'mongoose';

/**
 * Metadata for an image stored in MongoDB GridFS. The pixels live in GridFS (`fileId` = optimised
 * WebP, `thumbFileId` = small thumbnail); only ids and descriptive fields are kept here. Never base64.
 */
export function makeImageSchema({ withId = true, product = true } = {}) {
  const { Schema } = mongoose;
  const schema = new Schema(
    {
      fileId: { type: Schema.Types.ObjectId, required: true },
      thumbFileId: { type: Schema.Types.ObjectId },
      width: Number,
      height: Number,
      size: Number, // bytes of the stored (optimised) image
      mimeType: { type: String, default: 'image/webp' },
      originalName: { type: String, maxlength: 200 },
      ...(product && {
        alt: { type: String, trim: true, maxlength: 160, default: '' },
        isPrimary: { type: Boolean, default: false },
      }),
    },
    {
      _id: withId,
      id: false,
      toJSON: {
        virtuals: true,
        transform(_doc, ret) {
          delete ret.id;
          return ret;
        },
      },
    },
  );

  // Relative to the site root; the client prefixes the API origin when it is on a different domain.
  schema.virtual('url').get(function url() {
    return `/api/v1/media/${this.fileId}`;
  });
  schema.virtual('thumbUrl').get(function thumbUrl() {
    return `/api/v1/media/${this.thumbFileId ?? this.fileId}`;
  });
  return schema;
}
