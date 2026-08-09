export function createRunPayload({ awaitingClarification, text }) {
  if (awaitingClarification) {
    return {
      command: { resume: text },
      streamMode: "updates",
    };
  }

  return {
    input: {
      messages: [{ role: "user", content: text }],
      query: text,
      user_request: text,
    },
    streamMode: "updates",
  };
}
