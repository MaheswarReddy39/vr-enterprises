import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, passwordPolicyErrors, verifyPassword } from '../utils/password.js';
import { issueSession } from './auth.service.js';

export async function updateProfile(userId, data) {
  const user = await User.findByIdAndUpdate(userId, { $set: data }, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'Account not found.');
  return user;
}

/** Verifies the current password, sets the new one, signs out every other device and returns a fresh session. */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ApiError(400, 'Your current password is not correct.', [{ path: 'body.currentPassword', message: 'Your current password is not correct.' }]);
  }
  const problems = passwordPolicyErrors(newPassword);
  if (problems.length > 0) throw new ApiError(400, 'Validation failed.', problems.map((message) => ({ path: 'body.newPassword', message })));

  await User.updateOne({ _id: userId }, { $set: { passwordHash: await hashPassword(newPassword), refreshTokens: [] } });
  return issueSession(user);
}
