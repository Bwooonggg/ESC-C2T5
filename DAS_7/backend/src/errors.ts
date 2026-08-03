export class ApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class UnauthorizedError extends ApiError {
    constructor() { super(401, 'unauthorised'); }
}

/** 404 — messages used: 'progressUnavailable', 'summaryUnavailable', 'notFound' */
export class NotFoundError extends ApiError {
    constructor(message = 'notFound') { super(404, message); }
}

/** 400 — message must be human-readable (the UI may display it) */
export class ValidationError extends ApiError {
    constructor(message: string) { super(400, message); }
}

/** 503 — messages used: 'progressUnavailable', 'summaryUnavailable', 'recommendationUnavailable' */
export class UnavailableError extends ApiError {
    constructor(message: string) { super(503, message); }
}
