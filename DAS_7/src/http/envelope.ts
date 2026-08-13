import type { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200): void {
    res.status(status).json({ ok: true, data });
}

export function fail(res: Response, status: number, error: string): void {
    res.status(status).json({ ok: false, error });
}
