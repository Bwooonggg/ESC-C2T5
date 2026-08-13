import {
    findAssistantText,
    findWorksheet,
    findWorksheetInThreadState,
} from "../../src/worksheet/utils";

describe("worksheet state parsing", () => {
    const original = {
        title: "Grammar Practice",
        items: [
            {
                question: "The cat ____ on the mat.",
                options: ["sit", "sits", "sat", "sitting"],
                answer: "sits",
            },
        ],
    };

    const revised = {
        ...original,
        items: [
            {
                ...original.items[0],
                options: ["sit", "sits", "sat", "satting"],
            },
        ],
    };

    it("reads a worksheet from an update", () => {
        expect(findWorksheet({ generated_worksheet: revised })?.questions[0].options)
            .toContain("satting");
    });

    it("reads a worksheet from the final state", () => {
        const state = {
            values: {
                generated_worksheet: revised,
                messages: [{ content: "I updated the worksheet." }],
            },
        };

        expect(findWorksheetInThreadState(state)?.questions[0].options)
            .toEqual(["sit", "sits", "sat", "satting"]);
    });

    it("does not treat the latest human message as an assistant reply", () => {
        const event = {
            messages: [
                { type: "ai", content: "I created the worksheet." },
                { type: "human", content: "adjust question 2 runs to ranning" },
            ],
        };

        expect(findAssistantText(event)).toBeNull();
    });

    it("reads assistant text only from assistant-role messages", () => {
        expect(findAssistantText({
            worksheet_revision: {
                messages: [{ role: "assistant", content: "I updated the worksheet." }],
            },
        })).toBe("I updated the worksheet.");
    });
});
