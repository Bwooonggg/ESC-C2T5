export type WorksheetQuestion = { question?: string; text?: string; options?: string[]; answer?: string; correct_answer?: string };
export type Worksheet = { title?: string; topic?: string; instructions?: string; questions: WorksheetQuestion[] };

export function normalizeWorksheet(value: unknown): Worksheet | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const nested = record.worksheet ?? record.worksheetData ?? record.generated_worksheet ?? value;
    if (!nested || typeof nested !== "object") return null;
    const worksheet = nested as Record<string, unknown>;
    const questions = worksheet.questions ?? worksheet.items;
    if (!Array.isArray(questions)) return null;
    return { ...worksheet, questions } as Worksheet;
}

export function findWorksheet(value: unknown): Worksheet | null {
    const direct = normalizeWorksheet(value);
    if (direct) return direct;
    if (!value || typeof value !== "object") return null;
    for (const child of Object.values(value as Record<string, unknown>)) {
        const found = findWorksheet(child);
        if (found) return found;
    }
    return null;
}

export function findAssistantText(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.content === "string") return record.content;
    if (Array.isArray(record.messages)) {
        const last = record.messages.at(-1) as { content?: unknown } | undefined;
        if (typeof last?.content === "string") return last.content;
    }
    return null;
}

export function findClarification(value: unknown): string | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const interrupt = record.__interrupt__ ?? record.interrupt;
    if (!interrupt) return null;
    if (typeof interrupt === "string") return interrupt;
    return findAssistantText(interrupt) ?? "Please provide the missing worksheet details.";
}
