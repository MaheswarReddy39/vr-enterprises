import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, passwordPolicyErrors, verifyPassword } from '../utils/password.js';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './token.service.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const MAX_SESSIONS = 5;
const INVALID_LOGIN = 'Invalid email or password.';

// Compared against when the email is unknown so response time does not reveal which emails exist.
const dummyHash = await hashPassword('not-a-real-password');

export async function issueSession(user) {
  const refreshToken = signRefreshToken(user._id);
  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        refreshTokens: {
          $each: [{ tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000) }],
          $slice: -MAX_SESSIONS,
        },
      },
    },
  );
  return {
    accessToken: signAccessToken(user._id),
    expiresIn: ACCESS_TTL_SECONDS,
    refreshToken,
    user: user.toJSON(),
  };
}

export async function login(email, password) {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select(
    '+passwordHash +failedLoginAttempts +lockUntil',
  );

  if (!user) {
    await verifyPassword(password, dummyHash);
    throw new ApiError(401, INVALID_LOGIN);
  }
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new ApiError(429, `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk || !user.isActive) {
    if (!passwordOk) {
      const { failedLoginAttempts } = await User.findByIdAndUpdate(
        user._id,
        { $inc: { failedLoginAttempts: 1 } },
        { new: true, select: '+failedLoginAttempts' },
      );
      if (failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await User.updateOne(
          { _id: user._id },
          { $set: { lockUntil: new Date(Date.now() + LOCK_MINUTES * 60_000), failedLoginAttempts: 0 } },
        );
      }
    }
    throw new ApiError(401, INVALID_LOGIN);
  }

  await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } });
  return issueSession(user);
}

/** Public sign-up. Always creates a CUSTOMER: the role can never come from the request. */
export async function registerCustomer({ name, email, password, phone }) {
  const problems = passwordPolicyErrors(password);
  if (problems.length > 0) {
    throw new ApiError(400, 'Validation failed.', problems.map((message) => ({ path: 'body.password', message })));
  }
  const normalized = String(email).toLowerCase().trim();
  if (await User.exists({ email: normalized })) throw new ApiError(409, 'An account with this email already exists. Try signing in instead.');

  let user;
  try {
    user = await User.create({ name, email: normalized, ...(phone && { phone }), passwordHash: await hashPassword(password), role: 'customer' });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, 'An account with this email already exists. Try signing in instead.');
    throw error;
  }
  return issueSession(user);
}

/** Rotates the refresh token. A token that was already used or revoked signals theft: all sessions are revoked. */
export async function refreshSession(refreshToken) {
  if (!refreshToken) throw new ApiError(401, 'Not signed in.');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Session expired. Please sign in again.');
  }

  const tokenHash = hashToken(refreshToken);
  const user = await User.findOneAndUpdate(
    { _id: payload.sub, 'refreshTokens.tokenHash': tokenHash },
    { $pull: { refreshTokens: { tokenHash } } },
    { new: false },
  );

  if (!user) {
    await User.updateOne({ _id: payload.sub }, { $set: { refreshTokens: [] } });
    throw new ApiError(401, 'Session expired. Please sign in again.');
  }
  if (!user.isActive) throw new ApiError(401, 'Session expired. Please sign in again.');

  return issueSession(user);
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await User.updateOne({ _id: payload.sub }, { $pull: { refreshTokens: { tokenHash: hashToken(refreshToken) } } });
  } catch {
    // An invalid or expired token has nothing to revoke; logging out still succeeds.
  }
}
