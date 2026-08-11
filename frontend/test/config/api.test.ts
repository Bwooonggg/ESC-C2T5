import { API_BASE_URL, API_PREFIXES, createApiUrl } from "../../src/config/api";

describe("API configuration", () => {
  it("exports the API base URL without a trailing slash", () => {
    expect(API_BASE_URL).toBe("/api/insights");
  });

  it("stays relative, so the Vite proxy and same-origin production both work", () => {
    expect(API_BASE_URL.startsWith("/")).toBe(true);
    expect(API_BASE_URL).not.toMatch(/^https?:\/\//);
  });

  describe("createApiUrl", () => {
    it.each([
      ["a path without a leading slash", "users", "/api/insights/users"],
      ["a path with a leading slash", "/users", "/api/insights/users"],
      ["a nested path", "students/s1/summary", "/api/insights/students/s1/summary"],
    ])("joins %s to the API base URL", (_description, path, expectedUrl) => {
      expect(createApiUrl(path)).toBe(expectedUrl);
    });

    it("does not double up slashes", () => {
      expect(createApiUrl("/users")).not.toContain("//");
    });

    it("reserves stable prefixes for all three services", () => {
      expect(API_PREFIXES).toEqual({
        screening: "/api/screening",
        worksheet: "/api/worksheet",
        insights: "/api/insights",
      });
      expect(createApiUrl("sessions", "screening")).toBe("/api/screening/sessions");
      expect(createApiUrl("threads", "worksheet")).toBe("/api/worksheet/threads");
    });
  });
});
