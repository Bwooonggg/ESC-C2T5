// Only this line should be changed if the API URL changes.
//
// Relative on purpose. In dev, Vite proxies /api to the mock backend on :4000
// (see vite.config.ts); in production the app is served from the same origin as
// the API. Either way the frontend needs no CORS handling and no environment
// variable, and this file does not change between environments.
const baseUrl = "/api/";

// Use Regex matching to strip trailing slash
export const API_BASE_URL = baseUrl.replace(/\/$/, "");

// Construct API url given path
export function createApiUrl(path: string): string {
    // Prepend slash, if not already there
    const fixedPath = path.startsWith("/") ? path : `/${path}`;

    return `${API_BASE_URL}${fixedPath}`
}