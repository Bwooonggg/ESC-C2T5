import { createRunPayload } from "./runPayload.js";


describe("createRunPayload", () => {
  test("starts a normal run with only the new user message", () => {
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

  test("resumes the interrupted run with the clarification reply", () => {
    expect(
      createRunPayload({ awaitingClarification: true, text: "Make it MCQ" }),
    ).toEqual({
      command: { resume: "Make it MCQ" },
      streamMode: "updates",
    });
  });
});
