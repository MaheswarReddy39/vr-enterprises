import { z } from 'zod';
import { ROLES } from '../constants/roles.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword, passwordPolicyErrors } from '../utils/password.js';

const inputSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

/**
 * Creates the very first administrator. Refuses to run once any admin exists, so the script
 * can never be used to add a back-door admin to a live system.
 */
export async function createFirstAdmin({ name, email, password }) {
  const parsed = inputSchema.safeParse({ name, email });
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((i) => i.message).join(' '));
  }

  const problems = passwordPolicyErrors(password);
  if (problems.length > 0) throw new ApiError(400, problems.join(' '));

  if (await User.exists({ role: ROLES.ADMIN })) {
    throw new ApiError(
      409,
      'An administrator already exists. Additional admins must be created from the admin dashboard.',
    );
  }
  if (await User.exists({ email: parsed.data.email })) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  return User.create({
    ...parsed.data,
    passwordHash: await hashPassword(password),
    role: ROLES.ADMIN,
  });
}
