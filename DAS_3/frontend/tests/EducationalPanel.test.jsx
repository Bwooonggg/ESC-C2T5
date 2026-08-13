import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WorksheetPreview } from "../src/components/worksheet_preview.jsx";


describe("WorksheetPreview", () => {
  test("renders an MCQ worksheet", () => {
    const worksheet = {
      title: "Grade 3 Reading Comprehension",
      readingPassage: "Maya visited the community garden on Saturday.",
      instructions: "Read the passage and answer every question.",
      items: [
        {
          question: "Where did Maya go on Saturday?",
          options: [
            "The community garden",
            "The library",
            "The beach",
            "The market",
          ],
          answer: "The community garden",
        },
      ],
    };

    const markup = renderToStaticMarkup(
      React.createElement(WorksheetPreview, { worksheetData: worksheet }),
    );

    expect(markup).toContain("Grade 3 Reading Comprehension");
    expect(markup).toContain(
      "Maya visited the community garden on Saturday.",
    );
    expect(markup).toContain(
      "Read the passage and answer every question.",
    );
    expect(markup).toContain("Where did Maya go on Saturday?");
    expect(markup).toContain("The community garden");
    expect(markup).toContain("The library");
    expect(markup).toContain("The beach");
    expect(markup).toContain("The market");
    expect(markup).toContain('class="worksheet-option correct-option"');
    expect(markup).toContain('aria-label="The community garden (correct answer)"');
    expect(markup).toContain('class="worksheet-answer-key"');
    expect(markup).toContain("Answer Key");
    expect(markup).toContain("1.</strong> The community garden");
    expect(markup).toContain('class="worksheet-preview-wrapper"');
    expect(markup).toContain('class="worksheet-document"');
    expect(markup).toContain('class="worksheet-items"');
    expect(markup).toContain('class="worksheet-item"');
  });

  test("renders an open worksheet", () => {
    const worksheet = {
      title: "Band B Writing",
      readingPassage: "Write about the garden.",
      instructions: "Answer in complete sentences.",
      items: [
        {
          question: "What would you grow in the garden?",
          options: [],
          answer: "Answers will vary.",
        },
      ],
    };

    const markup = renderToStaticMarkup(
      React.createElement(WorksheetPreview, { worksheetData: worksheet }),
    );

    expect(markup).toContain("What would you grow in the garden?");
    expect(markup).toContain('class="open-ended-answer-space"');
    expect(markup).toContain('aria-label="Answer space"');
  });
});
