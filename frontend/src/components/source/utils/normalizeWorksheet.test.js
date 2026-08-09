import { normalizeWorksheet } from "./normalizeWorksheet.js";


describe("normalizeWorksheet", () => {
  test("accepts the canonical worksheet contract", () => {
    const worksheet = {
      title: "Reading Practice",
      readingPassage: "Maya visited the community garden.",
      instructions: "Read the passage and answer each question.",
      items: [
        {
          question: "Where did Maya go?",
          options: ["The garden", "The beach"],
          answer: "The garden",
        },
      ],
    };

    expect(normalizeWorksheet(worksheet)).toEqual(worksheet);
  });

  test("normalizes transitional worksheet aliases", () => {
    expect(
      normalizeWorksheet({
        reading_passage: "A short passage.",
        questions: [
          {
            text: "What is this passage about?",
            choices: ["Reading", "Running"],
            answer: "Reading",
          },
        ],
      }),
    ).toEqual({
      title: "Generated Worksheet",
      readingPassage: "A short passage.",
      instructions: "Read carefully and complete each item.",
      items: [
        {
          question: "What is this passage about?",
          options: ["Reading", "Running"],
          answer: "Reading",
        },
      ],
    });
  });

  test.each([
    null,
    {},
    { items: [] },
    { questions: [] },
    { items: [{ question: "" }] },
    { questions: [{ text: "" }] },
  ])("rejects invalid worksheet value %#", (value) => {
    expect(normalizeWorksheet(value)).toBeNull();
  });
});
