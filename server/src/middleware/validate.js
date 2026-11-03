import { ApiError } from '../utils/ApiError.js';

/**
 * Validates body / query / params with Zod schemas. Parsed (and coerced, stripped-of-unknown) values
 * are exposed as `req.valid.{body,query,params}`; handlers must use those, never the raw request.
 */
export const validate =
  ({ body, query, params }) =>
  (req, _res, next) => {
    req.valid = {};
    for (const [key, schema] of Object.entries({ body, query, params })) {
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((i) => ({ path: [key, ...i.path].join('.'), message: i.message }));
        return next(new ApiError(400, 'Validation failed.', details));
      }
      req.valid[key] = result.data;
    }
    next();
  };
