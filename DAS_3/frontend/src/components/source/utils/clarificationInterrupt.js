export function getClarificationPrompt(chunk) {
  if (!chunk || typeof chunk !== "object") return null;

  const interruptPayload =
    chunk.data?.__interrupt__ ??
    chunk.values?.__interrupt__ ??
    chunk.__interrupt__;

  if (chunk.event !== "interrupt" && interruptPayload === undefined) {
    return null;
  }

  const interrupt = Array.isArray(interruptPayload)
    ? interruptPayload[0]
    : interruptPayload;
  const value = interrupt?.value ?? interrupt ?? chunk.data;

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value?.prompt === "string" && value.prompt.trim()) {
    return value.prompt;
  }

  if (Array.isArray(value?.awaiting) && value.awaiting.length > 0) {
    return [
      "I need a bit more information:",
      ...value.awaiting.map((question) => `- ${question}`),
    ].join("\n");
  }

  return "I need a bit more information before I can generate the worksheet.";
}
