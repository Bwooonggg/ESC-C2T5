export function normalizeWorksheet(value) {
  if (!value || typeof value !== "object") return null;

  const rawItems = value.items ?? value.questions;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;

  const items = rawItems.map((item) => ({
    question: item?.question ?? item?.text ?? "",
    options: item?.options ?? item?.choices ?? [],
    answer: item?.answer ?? "",
  }));

  if (items.some((item) => !item.question)) return null;

  return {
    title: value.title ?? "Generated Worksheet",
    readingPassage:
      value.readingPassage ??
      value.reading_passage ??
      value.passage ??
      value.content ??
      "",
    instructions:
      value.instructions ?? "Read carefully and complete each item.",
    items,
  };
}
