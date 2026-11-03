import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const ISSUER = 'vr-enterprises';
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

function secrets() {
  if (!env.JWT_ACCESS_SECRET || !env.JWT_REFRESH_SECRET) {
    throw new ApiError(500, 'Authentication is not configured on the server.');
  }
  return { access: env.JWT_ACCESS_SECRET, refresh: env.JWT_REFRESH_SECRET };
}

// The token carries only the user id. Role and active status are always read from the database,
// so a tampered or stale token can never grant privileges.
export function signAccessToken(userId) {
  return jwt.sign({}, secrets().access, {
    subject: String(userId),
    issuer: ISSUER,
    audience: 'access',
    expiresIn: ACCESS_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function signRefreshToken(userId) {
  return jwt.sign({}, secrets().refresh, {
    subject: String(userId),
    issuer: ISSUER,
    audience: 'refresh',
    expiresIn: REFRESH_TTL_SECONDS,
    algorithm: 'HS256',
    jwtid: crypto.randomUUID(),
  });
}

const verify = (token, secret, audience) =>
  jwt.verify(token, secret, { issuer: ISSUER, audience, algorithms: ['HS256'] });

export const verifyAccessToken = (token) => verify(token, secrets().access, 'access');
export const verifyRefreshToken = (token) => verify(token, secrets().refresh, 'refresh');

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
