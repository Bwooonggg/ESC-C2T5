declare const __DAS1_API_URL__: string;
declare const __DAS3_API_URL__: string;
declare const __DAS7_API_URL__: string;

export const API_PREFIXES = {
    screening: typeof __DAS1_API_URL__ === "undefined" ? "/api/screening" : __DAS1_API_URL__,
    worksheet: typeof __DAS3_API_URL__ === "undefined" ? "/api/worksheet" : __DAS3_API_URL__,
    insights: typeof __DAS7_API_URL__ === "undefined" ? "/api/insights" : __DAS7_API_URL__,
} as const;

export type ApiService = keyof typeof API_PREFIXES;

// DAS 7 is the first subsystem connected to this shared frontend.
export const API_BASE_URL = API_PREFIXES.insights;

export function createApiUrl(path: string, service: ApiService = "insights"): string {
    const baseUrl = API_PREFIXES[service].replace(/\/$/, "");
    const fixedPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${fixedPath}`;
}
