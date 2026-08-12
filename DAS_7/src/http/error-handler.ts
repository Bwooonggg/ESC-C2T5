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

    // Express' JSON parser rejects malformed and oversized request bodies before
    // a route runs. Keep these client-input failures out of the opaque 500 path.
    const parserError = err as { status?: unknown; type?: unknown };
    if (parserError.status === 413 || parserError.type === 'entity.too.large') {
        fail(res, 413, 'requestTooLarge');
        return;
    }
    if (parserError.status === 400 || parserError.type === 'entity.parse.failed') {
        fail(res, 400, 'invalidJson');
        return;
    }

    console.error(err);
    fail(res, 500, 'internalError');
};
