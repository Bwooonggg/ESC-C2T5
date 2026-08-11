import {
    getCurrentParent,
    getPreferences,
    request,
    savePreferences,
    trackProgress,
} from "../../src/api/client";
import type { NotificationPreference } from "../../src/types/domain";
import { getAccessToken } from "../../src/api/auth";

jest.mock("../../src/api/auth", () => ({
    getAccessToken: jest.fn(),
}));

const getAccessTokenMock = jest.mocked(getAccessToken);

// These tests are about the client's contract with the backend: the paths it
// builds, the HTTP verbs it uses, and how it turns an envelope into either a
// value or an exception. The backend's own behaviour is verified by running it.

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
    const fetchMock = jest.fn().mockResolvedValue({
        ok: init.ok ?? true,
        status: init.status ?? 200,
        json: async () => body,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
}

function okEnvelope(data: unknown) {
    return { ok: true, data };
}

beforeEach(() => {
    getAccessTokenMock.mockResolvedValue("test-access-token");
});

afterEach(() => {
    jest.resetAllMocks();
});

describe("request", () => {
    it("unwraps the envelope and returns only the data", async () => {
        mockFetch(okEnvelope({ hello: "world" }));

        await expect(request("/thing")).resolves.toEqual({ hello: "world" });
    });

    it("throws the server's message when the envelope reports failure", async () => {
        mockFetch({ ok: false, error: "progressUnavailable" }, { ok: false, status: 503 });

        await expect(request("/thing")).rejects.toThrow("progressUnavailable");
    });

    it("reports a readable error when the response is not JSON", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => {
                throw new SyntaxError("Unexpected token <");
            },
        }) as unknown as typeof fetch;

        // The realistic case: mock backend down, Vite proxy returns HTML.
        await expect(request("/thing")).rejects.toThrow(/non-JSON response \(502\)/);
    });

    it("routes through createApiUrl, so every path is prefixed and relative", async () => {
        const fetchMock = mockFetch(okEnvelope(null));

        await request("/thing");

        expect(fetchMock.mock.calls[0][0]).toBe("/api/insights/thing");
    });

    it("sends the current Supabase access token as a bearer token", async () => {
        const fetchMock = mockFetch(okEnvelope(null));

        await request("/thing");

        const headers = fetchMock.mock.calls[0][1].headers as Headers;
        expect(headers.get("Authorization")).toBe("Bearer test-access-token");
    });

    it("does not call the backend when there is no authenticated session", async () => {
        const fetchMock = mockFetch(okEnvelope(null));
        getAccessTokenMock.mockRejectedValueOnce(new Error("Authentication required."));

        await expect(request("/thing")).rejects.toThrow("Authentication required.");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("endpoint methods", () => {
    it("getCurrentParent calls GET /api/insights/me", async () => {
        const fetchMock = mockFetch(okEnvelope({ parent: {}, students: [] }));

        await getCurrentParent();

        expect(fetchMock.mock.calls[0][0]).toBe("/api/insights/me");
    });

    it("trackProgress interpolates the studentId", async () => {
        const fetchMock = mockFetch(okEnvelope({ progress: [], summary: {} }));

        await trackProgress("s1");

        expect(fetchMock.mock.calls[0][0]).toBe("/api/insights/students/s1/track-progress");
        expect(fetchMock.mock.calls[0][0]).not.toContain("${");
    });

    it("getPreferences interpolates the parentId", async () => {
        const fetchMock = mockFetch(okEnvelope({ parentId: "p1" }));

        await getPreferences("p1");

        expect(fetchMock.mock.calls[0][0]).toBe("/api/insights/parents/p1/preferences");
    });
});

describe("savePreferences", () => {
    const prefs: NotificationPreference = {
        parentId: "p1",
        enabled: true,
        frequency: "Weekly",
        recipientEmail: "parent.demo@dial.sg",
    };

    it("PUTs the editable fields as JSON", async () => {
        const fetchMock = mockFetch(okEnvelope(prefs));

        await savePreferences("p1", prefs);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("/api/insights/parents/p1/preferences");
        expect(init.method).toBe("PUT");
        expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
        expect(JSON.parse(init.body)).toEqual({
            enabled: true,
            frequency: "Weekly",
            recipientEmail: "parent.demo@dial.sg",
        });
    });

    it("does not send parentId in the body — it travels in the URL", async () => {
        const fetchMock = mockFetch(okEnvelope(prefs));

        await savePreferences("p1", prefs);

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("parentId");
    });

    it("surfaces the backend's validation message", async () => {
        mockFetch(
            { ok: false, error: "`frequency` must be one of: Weekly, Fortnightly, Monthly." },
            { ok: false, status: 400 },
        );

        await expect(savePreferences("p1", prefs)).rejects.toThrow(/frequency` must be one of/);
    });
});
