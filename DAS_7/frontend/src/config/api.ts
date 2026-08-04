// Only this line should be changed if the API URL changes.
//
// Relative on purpose, and it is the DAS 7 *public* prefix. Traefik routes
// `/api/insights/*` to our backend and strips the prefix; the Vite dev proxy is
// configured to do the same against :4000 (see vite.config.ts). Either way the
// frontend needs no cross-origin handling and no environment variable, and this
// file does not change between environments.
const baseUrl = "/api/insights/";

// Use Regex matching to strip trailing slash
export const API_BASE_URL = baseUrl.replace(/\/$/, "");

// Construct API url given path
export function createApiUrl(path: string): string {
    // Prepend slash, if not already there
    const fixedPath = path.startsWith("/") ? path : `/${path}`;

    return `${API_BASE_URL}${fixedPath}`;
}
