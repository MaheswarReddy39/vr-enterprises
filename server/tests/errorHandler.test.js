import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { toErrorResponse } from '../src/middleware/errorHandler.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('toErrorResponse', () => {
  it('passes ApiError status and message through', () => {
    const { status, body } = toErrorResponse(new ApiError(404, 'Nope'));
    assert.equal(status, 404);
    assert.deepEqual(body, { success: false, message: 'Nope' });
  });

  it('maps Zod errors to 400 with field details', () => {
    const result = z.object({ email: z.string().email() }).safeParse({ email: 'x' });
    const { status, body } = toErrorResponse(result.error);
    assert.equal(status, 400);
    assert.equal(body.details[0].path, 'email');
  });

  it('maps duplicate-key errors to 409', () => {
    const { status, body } = toErrorResponse({ code: 11000, keyPattern: { email: 1 } });
    assert.equal(status, 409);
    assert.match(body.message, /email/);
  });

  it('maps Mongoose cast errors to 400', () => {
    const { status } = toErrorResponse({ name: 'CastError', path: '_id' });
    assert.equal(status, 400);
  });

  it('maps JWT errors to 401', () => {
    assert.equal(toErrorResponse({ name: 'TokenExpiredError' }).status, 401);
  });

  it('maps malformed JSON bodies to 400', () => {
    assert.equal(toErrorResponse({ type: 'entity.parse.failed' }).status, 400);
  });

  it('hides internals of unexpected errors in production', () => {
    const { status, body } = toErrorResponse(new Error('db password is hunter2'), {
      exposeInternals: false,
    });
    assert.equal(status, 500);
    assert.equal(body.debug, undefined);
    assert.doesNotMatch(body.message, /hunter2/);
  });

  it('includes debug info outside production', () => {
    const { body } = toErrorResponse(new Error('boom'), { exposeInternals: true });
    assert.equal(body.debug.message, 'boom');
  });
});
