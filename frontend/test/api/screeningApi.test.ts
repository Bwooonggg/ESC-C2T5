import { screeningApi } from "../../src/screening/api";

afterEach(() => jest.resetAllMocks());

describe("screening API", () => {
    it("UT-LOGIN-U18-01 uses the screening base URL without an Authorization header", async () => {
        const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "s1" }) });
        global.fetch = fetchMock as unknown as typeof fetch;

        await screeningApi.createSession("adult");

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("/api/screening/sessions");
        expect(init.headers).toEqual({ "Content-Type": "application/json" });
        expect(init.headers).not.toHaveProperty("Authorization");
    });
});
