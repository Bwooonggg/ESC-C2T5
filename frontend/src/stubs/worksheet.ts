import type { Worksheet } from "../worksheet/utils";

export async function createStubWorksheet(prompt: string): Promise<Worksheet> {
    await new Promise((resolve) => setTimeout(resolve, 450));
    const topic = prompt.length > 54 ? `${prompt.slice(0, 51)}…` : prompt;
    return {
        title: `Literacy Practice: ${topic}`,
        instructions: "Read each question carefully. Circle the best answer or write your response on the line.",
        questions: [
            {
                question: "Which sentence uses the correct subject–verb agreement?",
                options: ["The dogs runs in the park.", "The dogs run in the park.", "The dogs running in the park."],
                answer: "The dogs run in the park.",
            },
            {
                question: "Choose the word that best completes the sentence: The class ___ a story every Friday.",
                options: ["read", "reads", "reading"],
                answer: "reads",
            },
            {
                question: "Write one sentence about something you enjoy learning.",
                answer: "Answers will vary. Check for a clear subject and verb.",
            },
            {
                question: "Rewrite this sentence correctly: My friend like books.",
                answer: "My friend likes books.",
            },
        ],
    };
}
