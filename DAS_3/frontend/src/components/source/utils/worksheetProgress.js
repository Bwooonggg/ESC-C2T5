const PROGRESS_BY_NODE = {
  get_intent: "Finding relevant teaching material…",
  retrieve_and_rerank: "Creating and checking your worksheet…",
  worksheet_agent: "Finalizing your worksheet…",
};

function findProgress(value) {
  if (!value || typeof value !== "object") return null;

  for (const nodeName of Object.keys(PROGRESS_BY_NODE).reverse()) {
    if (Object.prototype.hasOwnProperty.call(value, nodeName)) {
      return PROGRESS_BY_NODE[nodeName];
    }
  }

  for (const nestedValue of Object.values(value)) {
    const progress = findProgress(nestedValue);
    if (progress) return progress;
  }

  return null;
}

export function getWorksheetProgress(chunk) {
  return findProgress(chunk?.data ?? chunk?.values ?? chunk);
}
