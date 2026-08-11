import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { createWorksheetClient } from "./client";
import { findAssistantText, findClarification, findWorksheet, type Worksheet } from "./utils";
import { WorksheetPreview } from "./WorksheetPreview";
import { USE_STUBS } from "../config/stubs";
import { createStubWorksheet } from "../stubs/worksheet";
import "./worksheet.css";

type ChatMessage = { id: string; role: "assistant" | "user"; text: string };
const GREETING = "Hello! What topic and band should the worksheet cover, and would you like MCQ or open-ended questions?";

export function WorksheetApp() {
    const [messages, setMessages] = useState<ChatMessage[]>([{ id: "hello", role: "assistant", text: GREETING }]);
    const [threadId, setThreadId] = useState<string | null>(null);
    const [input, setInput] = useState("");
    const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState("Understanding your request…");
    const [awaitingClarification, setAwaitingClarification] = useState(false);
    const [showAnswers, setShowAnswers] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);
    const navigate = useNavigate();

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        if (USE_STUBS) {
            setThreadId("preview-thread");
            return;
        }
        void createWorksheetClient()
            .then((client) => client.threads.create())
            .then((thread) => setThreadId(thread.thread_id))
            .catch((error: unknown) => void handleAuthError(error));
    }, []);

    async function getThread() {
        if (threadId) return threadId;
        if (USE_STUBS) {
            setThreadId("preview-thread");
            return "preview-thread";
        }
        const client = await createWorksheetClient();
        const thread = await client.threads.create();
        setThreadId(thread.thread_id);
        return thread.thread_id;
    }

    async function handleAuthError(error: unknown) {
        const statusCode = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
        if (statusCode === 401) { navigate("/worksheet/login", { replace: true }); return true; }
        if (statusCode === 403) { navigate("/access-denied/worksheet", { replace: true }); return true; }
        return false;
    }

    async function send(event: FormEvent) {
        event.preventDefault();
        const text = input.trim();
        if (!text || busy) return;
        setInput(""); setBusy(true); setStatus("Understanding your request…");
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text }]);
        try {
            if (USE_STUBS) {
                setStatus("Building a sample worksheet…");
                setWorksheet(await createStubWorksheet(text));
                setAwaitingClarification(false);
                setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: "Here is a sample worksheet using preview data. You can enter another prompt to try a different title." }]);
                return;
            }
            const activeThread = await getThread();
            // Recreate immediately before the run so refreshed tokens are never captured.
            const client = await createWorksheetClient();
            const streamMode: ("values" | "updates")[] = ["values", "updates"];
            const payload = awaitingClarification
                ? { command: { resume: text }, streamMode }
                : { input: { messages: [{ role: "user", content: text }] }, streamMode };
            const stream = client.runs.stream(activeThread, "educational_agent", payload);
            let nextWorksheet: Worksheet | null = null;
            let responseText = "";
            let clarification = "";
            for await (const chunk of stream) {
                const data: unknown = chunk.data ?? chunk;
                nextWorksheet = findWorksheet(data) ?? nextWorksheet;
                responseText = findAssistantText(data) ?? responseText;
                clarification = findClarification(data) ?? clarification;
                if (nextWorksheet) setStatus("Formatting your worksheet…");
                else setStatus("Building activities…");
            }
            if (clarification) {
                setAwaitingClarification(true);
                setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: responseText || clarification }]);
            } else if (nextWorksheet) {
                setAwaitingClarification(false); setWorksheet(nextWorksheet);
                setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: responseText && !responseText.trim().startsWith("{") ? responseText : "Your worksheet is ready. Ask for any changes you would like." }]);
            } else throw new Error("The service did not return a worksheet.");
        } catch (error) {
            if (!(await handleAuthError(error))) setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: "I couldn't generate a worksheet just now. Please try again." }]);
        } finally { setBusy(false); }
    }

    async function reset() { setMessages([{ id: "hello", role: "assistant", text: GREETING }]); setWorksheet(null); setThreadId(USE_STUBS ? "preview-thread" : null); setAwaitingClarification(false); }
    async function signOut() { await logout("worksheet"); navigate("/worksheet/login"); }

    return <main className="worksheet-workspace">
        <section className="preview-panel"><div className="panel-heading"><div><p>Live preview</p><h1>Activity worksheet</h1></div><div className="panel-actions"><button disabled={!worksheet} onClick={() => setShowAnswers(!showAnswers)}>{showAnswers ? "Hide" : "Show"} answers</button><button disabled={!worksheet} onClick={() => window.print()}>Print / PDF</button></div></div><div className="preview-scroll"><WorksheetPreview worksheet={worksheet} showAnswers={showAnswers} /></div></section>
        <section className="assistant-panel"><div className="panel-heading"><div><p>Teacher workspace</p><h2>Worksheet assistant</h2></div><button onClick={reset}>Reset</button></div><div className="chat-scroll" aria-live="polite">{messages.map((message) => <div key={message.id} className={`work-message ${message.role}`}><span>{message.role === "assistant" ? "Assistant" : "You"}</span><p>{message.text}</p></div>)}{busy && <div className="work-message assistant" role="status"><span>Assistant</span><p>{status}</p></div>}<div ref={endRef} /></div><form className="worksheet-composer" onSubmit={send}><label htmlFor="worksheet-prompt">Describe your worksheet</label><textarea id="worksheet-prompt" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Band A MCQ worksheet on subject-verb agreement…" disabled={busy} /><button disabled={busy || !input.trim()}>Send</button></form><div className="worksheet-footer"><button onClick={signOut}>Log out</button></div></section>
    </main>;
}
