import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** Maps any thrown value to `{ status, body }`. Pure, so it is easy to unit test. */
export function toErrorResponse(error, { exposeInternals = !env.isProduction } = {}) {
  let status = 500;
  let message = 'Something went wrong on our side. Please try again later.';
  let details;

  if (error instanceof ApiError) {
    ({ statusCode: status, message, details } = error);
  } else if (error instanceof ZodError) {
    status = 400;
    message = 'Validation failed.';
    details = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (error?.name === 'ValidationError' && error.errors) {
    status = 400; // Mongoose
    message = 'Validation failed.';
    details = Object.values(error.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (error?.name === 'CastError') {
    status = 400;
    message = `Invalid value for "${error.path}".`;
  } else if (error?.code === 11000) {
    status = 409;
    const fields = Object.keys(error.keyPattern ?? error.keyValue ?? {});
    message = fields.length ? `A record with this ${fields.join(', ')} already exists.` : 'Duplicate value.';
  } else if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
    status = 401;
    message = 'Invalid or expired authentication token.';
  } else if (error?.name === 'MulterError') {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    status = tooLarge ? 413 : 400;
    message = tooLarge
      ? 'Image is too large. The maximum size is 5 MB per image.'
      : error.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Too many images, or the upload used the wrong field name.'
        : error.message;
  } else if (error?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body.';
  } else if (error?.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large.';
  }

  const body = { success: false, message };
  if (details) body.details = details;
  if (status === 500 && exposeInternals) {
    body.debug = { name: error?.name, message: error?.message, stack: error?.stack };
  }
  return { status, body };
}

export function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by its 4 arguments
export function errorHandler(error, req, res, _next) {
  const { status, body } = toErrorResponse(error);
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, error);
  res.status(status).json(body);
}
