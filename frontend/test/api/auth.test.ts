import { getAccessToken } from "../../src/api/auth";
import { supabase } from "../../src/lib/supabaseClient";

jest.mock("../../src/lib/supabaseClient", () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
            signUp: jest.fn(),
            signInWithPassword: jest.fn(),
            signOut: jest.fn(),
        },
    },
}));

const getSessionMock = jest.mocked(supabase.auth.getSession);

afterEach(() => {
    jest.resetAllMocks();
});

describe("getAccessToken", () => {
    it("returns the current session's access token", async () => {
        getSessionMock.mockResolvedValue({
            data: {
                session: { access_token: "current-token" },
            },
            error: null,
        } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

        await expect(getAccessToken()).resolves.toBe("current-token");
    });

    it("rejects when no user is signed in", async () => {
        getSessionMock.mockResolvedValue({
            data: { session: null },
            error: null,
        } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

        await expect(getAccessToken()).rejects.toThrow("Authentication required.");
    });
});
