import { API_BASE_URL, createApiUrl } from "../../src/config/api";

describe("API configuration", () => {
  it("exports the API base URL without a trailing slash", () => {
    expect(API_BASE_URL).toBe("http://localhost:3000/api");
  });

  describe("createApiUrl", () => {
    it.each([
      ["a path without a leading slash", "users", "http://localhost:3000/api/users"],
      ["a path with a leading slash", "/users", "http://localhost:3000/api/users"],
    ])("joins %s to the API base URL", (_description, path, expectedUrl) => {
      expect(createApiUrl(path)).toBe(expectedUrl);
    });
  });
});
