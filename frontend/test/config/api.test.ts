import { API_BASE_URL, API_PREFIXES, createApiUrl } from "../../src/config/api";

describe("API configuration", () => {
  it("UT-LOGIN-U12-01 exports the API base URL without a trailing slash", () => {
    expect(API_BASE_URL).toBe("/api/insights");
  });

  it("UT-LOGIN-U12-02 stays relative, so the Vite proxy and same-origin production both work", () => {
    expect(API_BASE_URL.startsWith("/")).toBe(true);
    expect(API_BASE_URL).not.toMatch(/^https?:\/\//);
  });

  describe("createApiUrl", () => {
    it("UT-LOGIN-U12-03 joins a path without a leading slash", () => {
      expect(createApiUrl("users")).toBe("/api/insights/users");
    });

    it("UT-LOGIN-U12-04 joins a path with a leading slash", () => {
      expect(createApiUrl("/users")).toBe("/api/insights/users");
    });

    it("UT-LOGIN-U12-05 joins a nested path", () => {
      expect(createApiUrl("students/s1/summary")).toBe("/api/insights/students/s1/summary");
    });

    it("UT-LOGIN-U12-06 does not double up slashes", () => {
      expect(createApiUrl("/users")).not.toContain("//");
    });

    it("UT-LOGIN-U12-07 reserves stable prefixes for all three services", () => {
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
