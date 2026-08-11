import type { ContactDetails, ScreenerType, ScreeningSession } from "../screening/types";

const sessions = new Map<string, ScreeningSession>();

const questions: Record<ScreenerType, string[]> = {
    adult: [
        "Do you often need to reread a passage to understand it?",
        "Do spelling or written tasks take longer than you expect?",
        "Do you find it difficult to remember sequences or verbal instructions?",
    ],
    child: [
        "Does your child find it difficult to match letters with their sounds?",
        "Does your child avoid reading aloud or guess unfamiliar words?",
        "Does spelling remain difficult despite regular practice?",
    ],
};

const copy = (session: ScreeningSession): ScreeningSession => ({
    ...session,
    messages: [...session.messages],
    responses: { ...session.responses },
    questions: session.questions ? [...session.questions] : undefined,
    contact: session.contact ? { ...session.contact } : null,
});

const wait = () => new Promise((resolve) => setTimeout(resolve, 180));

function getSession(id: string): ScreeningSession {
    const session = sessions.get(id);
    if (!session) throw new Error("Preview screening session not found.");
    return session;
}

export async function stubScreeningPost(path: string, body: unknown): Promise<ScreeningSession> {
    await wait();
    const normalizedPath = `/${path.replace(/^\/+/, "")}`;
    const data = (body ?? {}) as Record<string, unknown>;

    if (normalizedPath === "/sessions") {
        const screenerType = data.screenerType as ScreenerType;
        const session: ScreeningSession = {
            id: crypto.randomUUID(),
            screenerType,
            stage: "screening",
            messages: [{
                role: "assistant",
                content: screenerType === "adult"
                    ? "I’ll ask a few questions about your experiences with reading, writing and memory. Answer in your own words, or use the Yes and No choices."
                    : "I’ll ask a few questions about your child’s reading and learning. Answer in your own words, or use the Yes and No choices.",
            }],
            responses: {},
            questions: questions[screenerType],
            notes: "",
            report: null,
            contact: null,
        };
        sessions.set(session.id, session);
        return copy(session);
    }

    const match = normalizedPath.match(/^\/sessions\/([^/]+)\/(messages|responses|report|contact)$/);
    if (!match) throw new Error(`No DAS 1 preview response is configured for ${normalizedPath}.`);

    const [, id, action] = match;
    const session = getSession(id);

    if (action === "messages") {
        const message = String(data.message ?? "");
        session.messages.push(
            { role: "user", content: message },
            { role: "assistant", content: "Thank you. You can add more detail, answer the questions alongside this conversation, or view your screening summary when you are ready." },
        );
        session.notes = String(data.notes ?? session.notes);
    }

    if (action === "responses") {
        session.responses[String(data.question ?? "")] = String(data.answer ?? "");
    }

    if (action === "report") {
        const yesCount = Object.values(session.responses).filter((answer) => answer === "Yes").length;
        session.notes = String(data.notes ?? session.notes);
        session.stage = "report";
        session.report = yesCount === 0
            ? "Your responses do not show a strong pattern in this short preview. If reading, writing or spelling difficulties continue to affect daily life or school, consider discussing them with a qualified professional."
            : `You selected “Yes” for ${yesCount} of ${session.questions?.length ?? 3} areas. This may suggest that further discussion could be useful, particularly where these difficulties are persistent or affect confidence and participation. A screening result is not a diagnosis.`;
    }

    if (action === "contact") {
        session.contact = data as ContactDetails;
        session.stage = "completed";
    }

    return copy(session);
}
