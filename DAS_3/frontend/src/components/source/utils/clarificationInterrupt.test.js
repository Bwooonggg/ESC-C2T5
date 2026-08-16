import { getClarificationPrompt } from "./clarificationInterrupt.js";


describe("getClarificationPrompt", () => {
  test("ignores normal updates", () => {
    expect(
      getClarificationPrompt({ event: "updates", data: { messages: [] } }),
    ).toBeNull();
  });

  test("formats interrupt fields", () => {
    const prompt = getClarificationPrompt({
      event: "updates",
      data: {
        __interrupt__: [
          {
            value: {
              awaiting: [
                "Would you like an MCQ or Open-ended worksheet?",
                "What topic should the worksheet cover?",
              ],
            },
          },
        ],
      },
    });

    expect(prompt).toContain("I need a bit more information:");
    expect(prompt).toContain("Would you like an MCQ or Open-ended worksheet?");
    expect(prompt).toContain("What topic should the worksheet cover?");
  });

  test("accepts direct prompts", () => {
    expect(
      getClarificationPrompt({
        event: "interrupt",
        data: { prompt: "Please choose MCQ or open-ended." },
      }),
    ).toBe("Please choose MCQ or open-ended.");
  });
});
