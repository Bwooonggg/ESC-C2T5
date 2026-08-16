const mockWorksheet = {
    auth: {
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
    },
};
const mockInsights = {
    auth: {
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
    },
};

jest.mock("../../src/lib/supabaseClients", () => ({
    worksheetSupabase: mockWorksheet,
    insightsSupabase: mockInsights,
}));
jest.mock("../../src/config/stubs", () => ({ USE_STUBS: false }));

import { getAccessToken, getAuthClient, login, logout } from "../../src/api/auth";

describe("shared authentication API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("UT-LOGIN-U02-01 selects the Worksheet client by identity", () => {
        expect(getAuthClient("worksheet")).toBe(mockWorksheet);
    });

    it("UT-LOGIN-U02-02 selects the Insights client by identity", () => {
        expect(getAuthClient("insights")).toBe(mockInsights);
    });

    it("UT-LOGIN-U03-01 forwards Worksheet credentials unchanged", async () => {
        const result = { data: { session: { access_token: "teacher-token" } }, error: null };
        mockWorksheet.auth.signInWithPassword.mockResolvedValue(result);

        await expect(login("worksheet", { email: "teacher@example.com", password: "secret" })).resolves.toBe(result);
        expect(mockWorksheet.auth.signInWithPassword).toHaveBeenCalledWith({ email: "teacher@example.com", password: "secret" });
        expect(mockInsights.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U03-02 forwards Insights credentials unchanged", async () => {
        const result = { data: { session: { access_token: "parent-token" } }, error: null };
        mockInsights.auth.signInWithPassword.mockResolvedValue(result);

        await expect(login("insights", { email: "parent@example.com", password: "secret" })).resolves.toBe(result);
        expect(mockInsights.auth.signInWithPassword).toHaveBeenCalledWith({ email: "parent@example.com", password: "secret" });
        expect(mockWorksheet.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U03-03 preserves a resolved Supabase authentication error", async () => {
        const result = { data: { session: null }, error: new Error("Invalid credentials") };
        mockWorksheet.auth.signInWithPassword.mockResolvedValue(result);

        await expect(login("worksheet", { email: "teacher@example.com", password: "secret" })).resolves.toBe(result);
    });

    it("UT-LOGIN-U03-04 preserves a rejected Supabase sign-in error", async () => {
        const networkError = new Error("network unavailable");
        mockInsights.auth.signInWithPassword.mockRejectedValue(networkError);

        await expect(login("insights", { email: "parent@example.com", password: "secret" })).rejects.toBe(networkError);
    });

    it("UT-LOGIN-U04-01 signs Worksheet out locally only", async () => {
        const result = { error: null };
        mockWorksheet.auth.signOut.mockResolvedValue(result);

        await expect(logout("worksheet")).resolves.toBe(result);
        expect(mockWorksheet.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
        expect(mockInsights.auth.signOut).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U04-02 signs Insights out locally only", async () => {
        const result = { error: null };
        mockInsights.auth.signOut.mockResolvedValue(result);

        await expect(logout("insights")).resolves.toBe(result);
        expect(mockInsights.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
        expect(mockWorksheet.auth.signOut).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U04-04 preserves a rejected sign-out error", async () => {
        const networkError = new Error("network unavailable");
        mockWorksheet.auth.signOut.mockRejectedValue(networkError);

        await expect(logout("worksheet")).rejects.toBe(networkError);
        expect(mockWorksheet.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    });

    it("UT-LOGIN-U05-02 returns the Worksheet session token", async () => {
        mockWorksheet.auth.getSession.mockResolvedValue({ data: { session: { access_token: "teacher-token" } }, error: null });

        await expect(getAccessToken("worksheet")).resolves.toBe("teacher-token");
        expect(mockInsights.auth.getSession).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U05-03 returns the Insights session token", async () => {
        mockInsights.auth.getSession.mockResolvedValue({ data: { session: { access_token: "parent-token" } }, error: null });

        await expect(getAccessToken("insights")).resolves.toBe("parent-token");
        expect(mockWorksheet.auth.getSession).not.toHaveBeenCalled();
    });

    it("UT-LOGIN-U05-04 rejects an errored session read", async () => {
        mockWorksheet.auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error("session failure") });

        await expect(getAccessToken("worksheet")).rejects.toThrow("Unable to read the authenticated session.");
    });

    it("UT-LOGIN-U05-05 rejects an absent session", async () => {
        mockInsights.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

        await expect(getAccessToken("insights")).rejects.toThrow("Authentication required.");
    });

    it("UT-LOGIN-U05-06 rejects an empty access token", async () => {
        mockWorksheet.auth.getSession.mockResolvedValue({ data: { session: { access_token: "" } }, error: null });

        await expect(getAccessToken("worksheet")).rejects.toThrow("Authentication required.");
    });

    it("UT-LOGIN-U05-07 returns a one-character access token unchanged", async () => {
        mockInsights.auth.getSession.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });

        await expect(getAccessToken("insights")).resolves.toBe("x");
    });
});
