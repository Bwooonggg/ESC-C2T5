import { createRunPayload } from "./runPayload.js";


describe("createRunPayload", () => {
  test("starts normal runs", () => {
    expect(
      createRunPayload({ awaitingClarification: false, text: "Band A verbs" }),
    ).toEqual({
      input: {
        messages: [{ role: "user", content: "Band A verbs" }],
        query: "Band A verbs",
        user_request: "Band A verbs",
      },
      streamMode: "updates",
    });
  });

  test("resumes interrupted runs", () => {
    expect(
      createRunPayload({ awaitingClarification: true, text: "Make it MCQ" }),
    ).toEqual({
      command: { resume: "Make it MCQ" },
      streamMode: "updates",
    });
  });
});
