export type ScreenerType = "adult" | "child";
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ContactDetails = { name: string; email: string; phone: string };
export type ScreeningSession = {
    id: string;
    screenerType: ScreenerType;
    stage: "screening" | "report" | "completed";
    messages: ChatMessage[];
    responses: Record<string, string>;
    questions?: string[];
    notes: string;
    report: string | null;
    contact: ContactDetails | null;
};
