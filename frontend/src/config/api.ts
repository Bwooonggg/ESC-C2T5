export const API_PREFIXES = {
    screening: "/api/screening",
    worksheet: "/api/worksheet",
    insights: "/api/insights",
} as const;

export type ApiService = keyof typeof API_PREFIXES;

// DAS 7 is the first subsystem connected to this shared frontend.
export const API_BASE_URL = API_PREFIXES.insights;

export function createApiUrl(path: string, service: ApiService = "insights"): string {
    const fixedPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_PREFIXES[service]}${fixedPath}`;
}
