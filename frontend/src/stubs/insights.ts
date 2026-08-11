import type {
    NotificationPreference,
    Parent,
    ProgressRecord,
    Recommendation,
    SkillArea,
    Student,
    Summary,
} from "../types/domain";

const parent: Parent = {
    parentId: "parent-preview",
    name: "Jamie Tan",
    email: "jamie.tan@example.com",
    mobileNumber: "+65 8123 4567",
    studentIds: ["student-maya", "student-ethan"],
};

const students: Student[] = [
    { studentId: "student-maya", name: "Maya Tan", dateOfBirth: "2016-04-18", bandLevel: "Band B" },
    { studentId: "student-ethan", name: "Ethan Tan", dateOfBirth: "2018-09-03", bandLevel: "Band A" },
];

const skills: SkillArea[] = [
    "Phonological Awareness",
    "Reading Accuracy",
    "Reading Fluency",
    "Spelling",
    "Writing",
    "Comprehension",
];

function progressFor(studentId: string, startingScores: number[]): ProgressRecord[] {
    const dates = ["2026-01-16", "2026-03-20", "2026-06-12"];
    return dates.flatMap((date, assessmentIndex) =>
        skills.map((skillArea, skillIndex) => ({
            recordId: `${studentId}-${assessmentIndex}-${skillIndex}`,
            studentId,
            date,
            skillArea,
            score: Math.min(96, startingScores[skillIndex] + assessmentIndex * (5 + (skillIndex % 3))),
            notes: "Sample progress record for interface preview.",
        })),
    );
}

const progressByStudent: Record<string, ProgressRecord[]> = {
    "student-maya": progressFor("student-maya", [58, 62, 51, 55, 60, 64]),
    "student-ethan": progressFor("student-ethan", [44, 49, 42, 47, 45, 53]),
};

const summaries: Record<string, Summary> = {
    "student-maya": {
        summaryId: "summary-maya",
        studentId: "student-maya",
        content: "Maya is reading more accurately and is beginning to apply spelling patterns independently. Continued practice with timed reading in short, comfortable sessions will help build fluency.",
        generatedAt: "2026-06-12T09:00:00Z",
    },
    "student-ethan": {
        summaryId: "summary-ethan",
        studentId: "student-ethan",
        content: "Ethan is making steady progress in sound awareness and comprehension. He benefits from clear instructions, repetition and opportunities to say a word before writing it.",
        generatedAt: "2026-06-12T09:00:00Z",
    },
};

let preference: NotificationPreference = {
    parentId: parent.parentId,
    enabled: true,
    frequency: "Fortnightly",
    recipientEmail: parent.email,
};

const wait = () => new Promise((resolve) => setTimeout(resolve, 180));

export async function stubInsightsRequest<T>(path: string, init?: RequestInit): Promise<T> {
    await wait();
    const normalizedPath = `/${path.replace(/^\/+/, "")}`;

    if (normalizedPath === "/me") return { parent, students } as T;

    const studentMatch = normalizedPath.match(/^\/students\/([^/]+)\/(track-progress|summary|recommendations)$/);
    if (studentMatch) {
        const [, studentId, resource] = studentMatch;
        const summary = summaries[studentId];
        if (!summary) throw new Error("Preview student not found.");
        if (resource === "track-progress") {
            return { progress: progressByStudent[studentId] ?? [], summary } as T;
        }
        if (resource === "summary") return summary as T;
        const recommendation: Recommendation = {
            recommendationId: `recommendation-${studentId}`,
            summaryId: summary.summaryId,
            content: studentId === "student-maya"
                ? "Try ten minutes of paired reading, then ask Maya to choose three words whose spelling pattern she would like to practise."
                : "Play a short sound-sorting game with familiar objects, then let Ethan explain the story in his own words.",
            generatedAt: new Date().toISOString(),
        };
        return recommendation as T;
    }

    if (/^\/parents\/[^/]+\/preferences$/.test(normalizedPath)) {
        if (init?.method === "PUT") {
            const update = JSON.parse(String(init.body ?? "{}")) as Partial<NotificationPreference>;
            if (!/^\S+@\S+\.\S+$/.test(update.recipientEmail ?? "")) {
                throw new Error("Enter a valid email address.");
            }
            preference = { ...preference, ...update, recipientEmail: update.recipientEmail!.toLowerCase() };
        }
        return preference as T;
    }

    throw new Error(`No preview response is configured for ${normalizedPath}.`);
}
