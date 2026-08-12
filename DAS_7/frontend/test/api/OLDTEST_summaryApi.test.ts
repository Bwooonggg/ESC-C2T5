import { getSummary } from "../../src/api/summaryApi";
import type { ApiEnvelope, Summary } from "../../src/types/domain";

// The original bug here was a template literal missing its `$`, so every call
// fetched the literal path `students/{studentId}/summary` and silently ignored
// its argument. Nothing caught it. The first test below is that regression.

const SUMMARY: Summary = {
    summaryId: "sum-s1",
    studentId: "s1",
    content: "Nur has had a good few months.",
    generatedAt: "2026-05-19T09:00:00.000Z",
};

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
    const fetchMock = jest.fn().mockResolvedValue({
        ok: init.ok ?? true,
        status: init.status ?? 200,
        json: async () => body,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
}

afterEach(() => {
    jest.resetAllMocks();
});

describe("getSummary", () => {
    it("interpolates the studentId into the request path", async () => {
        const envelope: ApiEnvelope<Summary> = { ok: true, data: SUMMARY };
        const fetchMock = mockFetch(envelope);

        await getSummary("s1");

        expect(fetchMock).toHaveBeenCalledWith("/api/insights/students/s1/summary");
        // Guards the exact defect: an uninterpolated literal.
        expect(fetchMock.mock.calls[0][0]).not.toContain("{studentId}");
    });

    it("unwraps the envelope and returns the Summary", async () => {
        mockFetch({ ok: true, data: SUMMARY } satisfies ApiEnvelope<Summary>);

        await expect(getSummary("s1")).resolves.toEqual(SUMMARY);
    });

    it("throws the server's message when the envelope reports failure", async () => {
        mockFetch({ ok: false, error: "progressUnavailable" }, { ok: false, status: 503 });

        await expect(getSummary("s1")).rejects.toThrow("progressUnavailable");
    });

    it("throws a readable error when the response is not JSON", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => {
                throw new SyntaxError("Unexpected token < in JSON");
            },
        }) as unknown as typeof fetch;

        await expect(getSummary("s1")).rejects.toThrow(/non-JSON response \(502\)/);
    });
});
