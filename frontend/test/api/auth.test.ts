import { getAccessToken, logout } from "../../src/api/auth";
import { insightsSupabase, worksheetSupabase } from "../../src/lib/supabaseClients";

jest.mock("../../src/lib/supabaseClients", () => ({
    worksheetSupabase: { auth: { getSession: jest.fn(), signOut: jest.fn(), signInWithPassword: jest.fn() } },
    insightsSupabase: { auth: { getSession: jest.fn(), signOut: jest.fn(), signInWithPassword: jest.fn() } },
}));

afterEach(() => jest.resetAllMocks());

describe("service-specific authentication", () => {
    it("reads the worksheet token only from the worksheet session", async () => {
        jest.mocked(worksheetSupabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: "teacher-token" } }, error: null } as Awaited<ReturnType<typeof worksheetSupabase.auth.getSession>>);
        await expect(getAccessToken("worksheet")).resolves.toBe("teacher-token");
        expect(insightsSupabase.auth.getSession).not.toHaveBeenCalled();
    });

    it("reads the insights token only from the insights session", async () => {
        jest.mocked(insightsSupabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: "parent-token" } }, error: null } as Awaited<ReturnType<typeof insightsSupabase.auth.getSession>>);
        await expect(getAccessToken("insights")).resolves.toBe("parent-token");
        expect(worksheetSupabase.auth.getSession).not.toHaveBeenCalled();
    });

    it("uses local sign-out so the other service remains signed in", async () => {
        jest.mocked(worksheetSupabase.auth.signOut).mockResolvedValue({ error: null });
        await logout("worksheet");
        expect(worksheetSupabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
        expect(insightsSupabase.auth.signOut).not.toHaveBeenCalled();
    });
});
