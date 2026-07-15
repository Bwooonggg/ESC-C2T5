import { createApiUrl } from "../config/api";
import type { ApiEnvelope, Summary } from "../types/domain";

<<<<<<< HEAD
export type SummaryResponse = {
    studentName: string;
    content: string;
};
=======
// GET /api/students/:studentId/summary  ->  the PM2 `Summary` entity.
//
// The backend answers every route in the { ok, data } | { ok, error } envelope.
// Unwrapping it here means callers get a Summary or an exception, and never
// have to reason about the transport.
export async function getSummary(studentId: string): Promise<Summary> {
    const response = await fetch(createApiUrl(`students/${studentId}/summary`));
>>>>>>> 6da49cb216263b4973754c162bb146f0c59d1d19

    let body: ApiEnvelope<Summary>;
    try {
        body = await response.json();
    } catch {
        // Not JSON at all — the mock backend is down and the dev proxy is
        // answering, or something upstream returned an HTML error page.
        throw new Error(
            `Unable to load summary: the server returned a non-JSON response (${response.status}).`,
        );
    }

    // An error envelope carries a useful message; prefer it over the bare status.
    if (!body.ok) throw new Error(body.error);
    if (!response.ok) throw new Error(`Unable to load summary: ${response.status}`);

    return body.data;
}
