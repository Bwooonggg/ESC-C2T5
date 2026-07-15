import { createApiUrl } from "../config/api";
import type { ApiEnvelope, Recommendation } from "../types/domain";

export async function getRecommendation(studentId: string): Promise<Recommendation> {
    const response = await fetch(createApiUrl(`students/${studentId}/recommendations`), {
        method: "POST",
    });

    let body: ApiEnvelope<Recommendation>;
    try {
        body = await response.json();
    } catch {
        // Not JSON at all — the mock backend is down and the dev proxy is
        // answering, or something upstream returned an HTML error page.
        throw new Error(
            `Unable to load recommendations: the server returned a non-JSON response (${response.status}).`,
        );
    }

    // An error envelope carries a useful message; prefer it over the bare status.
    if (!body.ok) throw new Error(body.error);
    if (!response.ok) throw new Error(`Unable to load recommendations: ${response.status}`);

    return body.data;
}
