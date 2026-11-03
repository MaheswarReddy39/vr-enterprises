import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_ADDRESSES = 10;

const load = async (userId) => User.findById(userId);

/** Keeps exactly one default address (the first one added becomes the default). */
function normaliseDefault(user, preferredId) {
  if (user.addresses.length === 0) return;
  const chosen = (preferredId && user.addresses.id(preferredId)) || user.addresses.find((a) => a.isDefault) || user.addresses[0];
  user.addresses.forEach((a) => {
    a.isDefault = a === chosen;
  });
}

export async function listAddresses(userId) {
  return (await load(userId)).addresses;
}

export async function addAddress(userId, data) {
  const user = await load(userId);
  if (user.addresses.length >= MAX_ADDRESSES) throw new ApiError(400, `You can save up to ${MAX_ADDRESSES} addresses.`);
  user.addresses.push(data);
  const added = user.addresses[user.addresses.length - 1];
  normaliseDefault(user, data.isDefault || user.addresses.length === 1 ? added._id : undefined);
  await user.save();
  return user.addresses;
}

export async function updateAddress(userId, addressId, data) {
  const user = await load(userId);
  const address = user.addresses.id(addressId);
  if (!address) throw new ApiError(404, 'Address not found.');
  address.set(data);
  normaliseDefault(user, data.isDefault ? addressId : undefined);
  await user.save();
  return user.addresses;
}

export async function deleteAddress(userId, addressId) {
  const user = await load(userId);
  const address = user.addresses.id(addressId);
  if (!address) throw new ApiError(404, 'Address not found.');
  address.deleteOne();
  normaliseDefault(user);
  await user.save();
  return user.addresses;
}
