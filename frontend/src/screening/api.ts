import { createApiUrl } from "../config/api";
import type { ContactDetails, ScreenerType, ScreeningSession } from "./types";
import { USE_STUBS } from "../config/stubs";
import { stubScreeningPost } from "../stubs/screening";

async function post(path: string, body: unknown): Promise<ScreeningSession> {
    if (USE_STUBS) return stubScreeningPost(path, body);

    const response = await fetch(createApiUrl(path, "screening"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error ?? `Screening request failed (${response.status}).`);
    }
    return response.json() as Promise<ScreeningSession>;
}

export const screeningApi = {
    createSession: (screenerType: ScreenerType) => post("/sessions", { screenerType }),
    sendMessage: (id: string, message: string, notes: string) => post(`/sessions/${id}/messages`, { message, notes }),
    recordAnswer: (id: string, question: string, answer: string) => post(`/sessions/${id}/responses`, { question, answer }),
    requestReport: (id: string, notes: string) => post(`/sessions/${id}/report`, { notes }),
    submitContact: (id: string, contact: ContactDetails) => post(`/sessions/${id}/contact`, contact),
};
