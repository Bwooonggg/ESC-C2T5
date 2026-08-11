import type { Summary } from "../types/domain";
import { request } from "./client";

// GET /api/insights/students/:studentId/summary  ->  the PM2 `Summary` entity.
//
// The backend answers every route in the { ok, data } | { ok, error } envelope.
// Unwrapping it here means callers get a Summary or an exception, and never
// have to reason about the transport.
export async function getSummary(studentId: string): Promise<Summary> {
    return request<Summary>(`students/${studentId}/summary`);
}
