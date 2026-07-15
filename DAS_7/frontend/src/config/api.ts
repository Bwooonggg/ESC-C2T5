// Only this line should be changed if the API URL changes
const baseUrl = "http://localhost:3000/api/";

// Use Regex matching to strip trailing slash
export const API_BASE_URL = baseUrl.replace(/\/$/, "");

// Construct API url given path
export function createApiUrl(path: string): string {
    // Prepend slash, if not already there
    const fixedPath = path.startsWith("/") ? path : `/${path}`;

    return `${API_BASE_URL}${fixedPath}`;
}