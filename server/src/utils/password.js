import bcrypt from 'bcryptjs';

const COST = 12;
const MAX_BYTES = 72; // bcrypt silently ignores anything past 72 bytes

export const hashPassword = (plain) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

/** Returns a list of human-readable problems; an empty list means the password is acceptable. */
export function passwordPolicyErrors(password) {
  const errors = [];
  if (typeof password !== 'string') return ['Password is required.'];
  if (password.length < 10) errors.push('Password must be at least 10 characters long.');
  if (Buffer.byteLength(password) > MAX_BYTES) {
    errors.push(`Password must be at most ${MAX_BYTES} bytes long.`);
  }
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter.');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter.');
  if (!/\d/.test(password)) errors.push('Password must contain a digit.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain a symbol.');
  return errors;
}
