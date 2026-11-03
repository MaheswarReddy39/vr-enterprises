import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
import { REFRESH_TTL_SECONDS } from '../services/token.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const COOKIE_NAME = 'vr_refresh';

const cookieOptions = {
  httpOnly: true, // not readable from JavaScript, so XSS cannot steal it
  secure: env.isProduction || env.COOKIE_SAME_SITE === 'none',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/api/v1/auth', // only sent to auth endpoints
};

export const setRefreshCookie = (res, token) =>
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: REFRESH_TTL_SECONDS * 1000 });

export const sessionResponse = ({ accessToken, expiresIn, user }) => ({ success: true, accessToken, expiresIn, user });

export const login = asyncHandler(async (req, res) => {
  const session = await authService.login(req.valid.body.email, req.valid.body.password);
  setRefreshCookie(res, session.refreshToken);
  res.json(sessionResponse(session));
});

export const register = asyncHandler(async (req, res) => {
  const session = await authService.registerCustomer(req.valid.body);
  setRefreshCookie(res, session.refreshToken);
  res.status(201).json(sessionResponse(session));
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    const session = await authService.refreshSession(req.cookies?.[COOKIE_NAME]);
    setRefreshCookie(res, session.refreshToken);
    res.json(sessionResponse(session));
  } catch (error) {
    res.clearCookie(COOKIE_NAME, cookieOptions);
    throw error;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ success: true });
});

export const me = (req, res) => {
  res.json({ success: true, user: req.user.toJSON() });
};
