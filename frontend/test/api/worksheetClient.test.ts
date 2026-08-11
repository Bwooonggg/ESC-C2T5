import { Client } from "@langchain/langgraph-sdk";
import { getAccessToken } from "../../src/api/auth";
import { createWorksheetClient } from "../../src/worksheet/client";

jest.mock("@langchain/langgraph-sdk", () => ({ Client: jest.fn() }));
jest.mock("../../src/api/auth", () => ({ getAccessToken: jest.fn() }));

afterEach(() => jest.resetAllMocks());

describe("worksheet client", () => {
    it("reads the latest worksheet token whenever a client is created", async () => {
        jest.mocked(getAccessToken).mockResolvedValueOnce("teacher-one").mockResolvedValueOnce("teacher-refreshed");

        await createWorksheetClient();
        await createWorksheetClient();

        expect(getAccessToken).toHaveBeenNthCalledWith(1, "worksheet");
        expect(getAccessToken).toHaveBeenNthCalledWith(2, "worksheet");
        expect(jest.mocked(Client).mock.calls[0][0]).toMatchObject({ defaultHeaders: { Authorization: "Bearer teacher-one" } });
        expect(jest.mocked(Client).mock.calls[1][0]).toMatchObject({ defaultHeaders: { Authorization: "Bearer teacher-refreshed" } });
    });
});
