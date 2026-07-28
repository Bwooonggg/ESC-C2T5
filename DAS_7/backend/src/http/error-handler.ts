import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../errors.js';
import { fail } from './envelope.js';

/** Terminal middleware: nothing matched the request. */
export const notFoundHandler: RequestHandler = (_req, res) => {
    fail(res, 404, 'notFound');
};

/**
 * Express error middleware. ApiError carries its own status and message;
 * anything else is logged and reported as an opaque 500 so internals do not leak.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ApiError) {
        fail(res, err.status, err.message);
        return;
    }
    console.error(err);
    fail(res, 500, 'internalError');
};
