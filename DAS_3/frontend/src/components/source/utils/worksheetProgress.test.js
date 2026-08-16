import { getWorksheetProgress } from "./worksheetProgress.js";

describe("getWorksheetProgress", () => {
  test("reports retrieval", () => {
    const chunk = { data: { get_intent: { qn_type: "MCQ" } } };

    expect(getWorksheetProgress(chunk)).toBe(
      "Finding relevant teaching material…",
    );
  });

  test("reports creation", () => {
    const chunk = {
      event: "updates",
      data: { retrieve_and_rerank: { rankedDocs: [] } },
    };

    expect(getWorksheetProgress(chunk)).toBe(
      "Creating and checking your worksheet…",
    );
  });

  test("reports finalization", () => {
    const chunk = {
      values: { update: { worksheet_agent: { generated_worksheet: {} } } },
    };

    expect(getWorksheetProgress(chunk)).toBe("Finalizing your worksheet…");
  });

  test("ignores unrelated events", () => {
    expect(getWorksheetProgress({ data: { heartbeat: true } })).toBeNull();
  });
});
