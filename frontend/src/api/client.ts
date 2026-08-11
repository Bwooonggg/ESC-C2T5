import { createApiUrl } from "../config/api";
import type {
    ApiEnvelope,
    NotificationPreference,
    Parent,
    ProgressRecord,
    Student,
    Summary,
} from "../types/domain";
import { getAccessToken } from "./auth";

// The typed API client. Components call the functions at the bottom of this
// file and never touch fetch, URLs, or the response envelope themselves.
//
// The names mirror the mock backend's controller methods on purpose: swapping
// the mock backend for the real one should change nothing above this line.
//
// Note there is no `getSummary` here. In the PM2 sequence diagram, Get Summary
// is an <<include>> of Track Child's Progress — the summary is always produced
// as part of tracking, never as a separate parent action — so it arrives inside
// `trackProgress()`. The standalone endpoint lives in ./summaryApi.ts.

/**
 * One fetch wrapper for every endpoint.
 *
 * The backend answers everything in the { ok, data } | { ok, error } envelope.
 * Unwrapping it here means every caller has exactly one success path and one
 * `catch`, instead of re-deriving "did this work?" from the status code.
 *
 * `<T>` is what the endpoint returns on success — the caller names it, and
 * TypeScript checks the rest of the chain against it.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${await getAccessToken()}`);

    const response = await fetch(createApiUrl(path), { ...init, headers });

    let body: ApiEnvelope<T>;
    try {
        body = await response.json();
    } catch {
        // Not JSON at all — usually the mock backend is down and the Vite dev
        // proxy is answering with an HTML error page. Say so, rather than
        // letting a raw SyntaxError surface in the UI.
        throw new Error(
            `Request to ${path} failed: the server returned a non-JSON response (${response.status}).`,
        );
    }

    // An error envelope carries a real message; prefer it over the bare status.
    if (!body.ok) throw new Error(body.error);
    if (!response.ok) throw new Error(`Request to ${path} failed: ${response.status}.`);

    return body.data;
}

// GET /api/insights/me — the logged-in parent and their children.
export function getCurrentParent(): Promise<{ parent: Parent; students: Student[] }> {
    return request<{ parent: Parent; students: Student[] }>("/me");
}

// GET /api/insights/students/:studentId/track-progress
// Progress records and the summary together — see the <<include>> note above.
export function trackProgress(
    studentId: string,
): Promise<{ progress: ProgressRecord[]; summary: Summary }> {
    return request<{ progress: ProgressRecord[]; summary: Summary }>(
        `/students/${studentId}/track-progress`,
    );
}

// GET /api/insights/parents/:parentId/preferences
export function getPreferences(parentId: string): Promise<NotificationPreference> {
    return request<NotificationPreference>(`/parents/${parentId}/preferences`);
}

// PUT /api/insights/parents/:parentId/preferences
// parentId travels in the URL, so the body carries only the editable fields.
export function savePreferences(
    parentId: string,
    prefs: NotificationPreference,
): Promise<NotificationPreference> {
    return request<NotificationPreference>(`/parents/${parentId}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            enabled: prefs.enabled,
            frequency: prefs.frequency,
            recipientEmail: prefs.recipientEmail,
        }),
    });
}
