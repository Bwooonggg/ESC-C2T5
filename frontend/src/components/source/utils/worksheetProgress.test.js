import { getWorksheetProgress } from "./worksheetProgress.js";

describe("getWorksheetProgress", () => {
  test("reports retrieval after intent detection", () => {
    const chunk = { data: { get_intent: { qn_type: "MCQ" } } };

    expect(getWorksheetProgress(chunk)).toBe(
      "Finding relevant teaching material…",
    );
  });

  test("reports worksheet creation after retrieval", () => {
    const chunk = {
      event: "updates",
      data: { retrieve_and_rerank: { rankedDocs: [] } },
    };

    expect(getWorksheetProgress(chunk)).toBe(
      "Creating and checking your worksheet…",
    );
  });

  test("reports finalization for a nested worksheet update", () => {
    const chunk = {
      values: { update: { worksheet_agent: { generated_worksheet: {} } } },
    };

    expect(getWorksheetProgress(chunk)).toBe("Finalizing your worksheet…");
  });

  test("ignores unrelated stream events", () => {
    expect(getWorksheetProgress({ data: { heartbeat: true } })).toBeNull();
  });
});
