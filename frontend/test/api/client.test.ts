import {
    getCurrentParent,
    getPreferences,
    request,
    savePreferences,
    sendUpdateNow,
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
    it("UT-LOGIN-U13-01 reports a readable error when the response is not JSON", async () => {
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

    it("UT-LOGIN-U13-02 routes through createApiUrl, so every path is prefixed and relative", async () => {
        const fetchMock = mockFetch(okEnvelope(null));

        await request("/thing");

        expect(fetchMock.mock.calls[0][0]).toBe("/api/insights/thing");
    });

});

describe("endpoint methods", () => {
    it("UT-LOGIN-U14-01 getCurrentParent calls GET /api/insights/me", async () => {
        const fetchMock = mockFetch(okEnvelope({ parent: {}, students: [] }));

        await getCurrentParent();

        expect(fetchMock.mock.calls[0][0]).toBe("/api/insights/me");
    });

    it("UT-LOGIN-U14-02 trackProgress interpolates the studentId", async () => {
        const fetchMock = mockFetch(okEnvelope({ progress: [], summary: {} }));

        await trackProgress("s1");

        expect(fetchMock.mock.calls[0][0]).toBe("/api/insights/students/s1/track-progress");
        expect(fetchMock.mock.calls[0][0]).not.toContain("${");
    });

    it("UT-LOGIN-U14-03 getPreferences interpolates the parentId", async () => {
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

    it("UT-LOGIN-U15-01 PUTs the editable fields as JSON", async () => {
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

    it("UT-LOGIN-U15-02 does not send parentId in the body — it travels in the URL", async () => {
        const fetchMock = mockFetch(okEnvelope(prefs));

        await savePreferences("p1", prefs);

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("parentId");
    });

    it("UT-LOGIN-U15-03 surfaces the backend's validation message", async () => {
        mockFetch(
            { ok: false, error: "`frequency` must be one of: Weekly, Fortnightly, Monthly." },
            { ok: false, status: 400 },
        );

        await expect(savePreferences("p1", prefs)).rejects.toThrow(/frequency` must be one of/);
    });
});

describe("sendUpdateNow", () => {
    it("UT-LOGIN-U16-01 POSTs to the signed-in parent's notification endpoint", async () => {
        const fetchMock = mockFetch(okEnvelope({ outcome: "parentNotified" }));

        await sendUpdateNow("p1");

        expect(fetchMock.mock.calls[0][0]).toBe("/api/insights/parents/p1/notifications");
        expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    });
});

describe("authentication boundary", () => {
    function response(body: unknown, status = 200, ok = status >= 200 && status < 300) {
        global.fetch = jest.fn().mockResolvedValue({ ok, status, json: async () => body }) as unknown as typeof fetch;
        return global.fetch as jest.MockedFunction<typeof fetch>;
    }

    it("UT-LOGIN-U11-01 sends the current token while preserving custom headers", async () => {
        getAccessTokenMock.mockResolvedValue("token");
        const fetchMock = response(okEnvelope({ value: 1 }));

        await expect(request<{ value: number }>("/thing", { headers: { "X-Request-ID": "r1" } })).resolves.toEqual({ value: 1 });

        const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
        expect(headers.get("Authorization")).toBe("Bearer token");
        expect(headers.get("X-Request-ID")).toBe("r1");
    });

    it("UT-LOGIN-U11-02 does not fetch when token retrieval fails", async () => {
        const tokenError = new Error("Authentication required.");
        getAccessTokenMock.mockRejectedValue(tokenError);
        const dispatch = jest.spyOn(window, "dispatchEvent");

        await expect(request("/thing")).rejects.toBe(tokenError);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
        dispatch.mockRestore();
    });

    async function expectAuthFailure(status: 401 | 403) {
        const dispatch = jest.spyOn(window, "dispatchEvent");
        response({ ok: false, error: `server-${status}` }, status, false);

        await expect(request("/thing")).rejects.toMatchObject({ name: "InsightsApiError", status, message: `server-${status}` });

        expect(dispatch).toHaveBeenCalledTimes(1);
        const event = dispatch.mock.calls[0][0] as CustomEvent<{ service: string; status: number }>;
        expect(event.type).toBe("dial:auth-failure");
        expect(event.detail).toEqual({ service: "insights", status });
        dispatch.mockRestore();
    }

    async function expectNoAuthFailure(status: 400 | 402 | 404 | 500) {
        const dispatch = jest.spyOn(window, "dispatchEvent");
        response({ ok: false, error: `server-${status}` }, status, false);

        await expect(request("/thing")).rejects.toMatchObject({ name: "InsightsApiError", status, message: `server-${status}` });

        expect(dispatch).not.toHaveBeenCalled();
        dispatch.mockRestore();
    }

    it("UT-LOGIN-U11-03 emits an auth-failure event for status 401", async () => {
        await expectAuthFailure(401);
    });

    it("UT-LOGIN-U11-04 emits an auth-failure event for status 403", async () => {
        await expectAuthFailure(403);
    });

    it("UT-LOGIN-U11-05 does not emit an auth-failure event for status 500", async () => {
        await expectNoAuthFailure(500);
    });

    it("UT-LOGIN-U11-06 does not emit an auth-failure event for status 400", async () => {
        await expectNoAuthFailure(400);
    });

    it("UT-LOGIN-U11-07 does not emit an auth-failure event for status 402", async () => {
        await expectNoAuthFailure(402);
    });

    it("UT-LOGIN-U11-08 does not emit an auth-failure event for status 404", async () => {
        await expectNoAuthFailure(404);
    });
});
