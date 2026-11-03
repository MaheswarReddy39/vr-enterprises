import mongoose from 'mongoose';

// One server-side cart per signed-in user. Only product ids and quantities are stored: prices and
// availability are always read fresh from the catalogue, so a client can never set a price.
const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: {
      type: [
        new mongoose.Schema(
          {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            quantity: { type: Number, required: true, min: 1, max: 10, validate: { validator: Number.isInteger, message: 'quantity must be a whole number' } },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const Cart = mongoose.models.Cart ?? mongoose.model('Cart', cartSchema);
