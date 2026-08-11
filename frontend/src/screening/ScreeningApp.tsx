import { useEffect, useRef, useState, type FormEvent } from "react";
import { screeningApi } from "./api";
import type { ContactDetails, ScreenerType, ScreeningSession } from "./types";
import "./screening.css";

function ScreeningFlow({ type, onBack }: { type: ScreenerType; onBack: () => void }) {
    const [session, setSession] = useState<ScreeningSession | null>(null);
    const [message, setMessage] = useState("");
    const [notes, setNotes] = useState("");
    const [showContact, setShowContact] = useState(false);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState("");
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        screeningApi.createSession(type).then(setSession).catch((value: unknown) => setError(value instanceof Error ? value.message : "Unable to start screening.")).finally(() => setBusy(false));
    }, [type]);

    async function update(action: (current: ScreeningSession) => Promise<ScreeningSession>) {
        if (!session) return;
        setBusy(true); setError("");
        try { setSession(await action(session)); }
        catch (value) { setError(value instanceof Error ? value.message : "Something went wrong."); }
        finally { setBusy(false); }
    }

    function send(event: FormEvent) {
        event.preventDefault();
        const text = message.trim();
        if (!text) return;
        setMessage("");
        void update((current) => screeningApi.sendMessage(current.id, text, notes));
    }

    if (!session) return <main className="screen-shell"><button className="text-button" onClick={onBack}>← Choose another screener</button><p aria-busy={busy}>{error || "Starting screener…"}</p></main>;
    const questions = session.questions ?? [];

    return (
        <main className="screen-shell">
            <div className="screen-flow-header">
                <button className="text-button" onClick={onBack}>← Choose another screener</button>
                <div className="screen-heading"><p>Guided screening</p><h1>{type === "adult" ? "Adult" : "Child"} screener</h1><p>This tool is informational and does not provide a diagnosis.</p></div>
            </div>
            {session.stage === "screening" && <div className="screen-columns">
                <section className="screen-card chat-card"><h2>Conversation</h2><div className="messages" aria-live="polite">{session.messages.map((item, index) => <div className={`message ${item.role}`} key={`${item.role}-${index}`}><strong>{item.role === "assistant" ? "DAS guide" : "You"}</strong><p>{item.content}</p></div>)}</div><form onSubmit={send}><label htmlFor="screen-message">Your response</label><textarea id="screen-message" value={message} onChange={(event) => setMessage(event.target.value)} disabled={busy} /><button disabled={busy || !message.trim()}>Send response</button></form></section>
                <aside className="screen-card question-card"><h2>Questions</h2><div className="questions-scroll">{questions.length ? questions.map((question) => <fieldset key={question} disabled={busy}><legend>{question}</legend>{["Yes", "No"].map((answer) => <label key={answer}><input type="radio" name={question} checked={session.responses?.[question] === answer} onChange={() => void update((current) => screeningApi.recordAnswer(current.id, question, answer))} /> {answer}</label>)}</fieldset>) : <p>Continue the conversation to work through the screening questions.</p>}<label htmlFor="screen-notes">Optional notes</label><textarea id="screen-notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div><button onClick={() => void update((current) => screeningApi.requestReport(current.id, notes))} disabled={busy}>View screening summary</button></aside>
            </div>}
            {session.stage === "report" && <section className="screen-card report"><p className="report-label">Screening summary</p><h2>Your results</h2><div className="report-copy">{session.report}</div><p>This summary is not a diagnosis. A qualified professional can discuss assessment options with you.</p>{!showContact && <button onClick={() => setShowContact(true)}>Request a follow-up</button>}{showContact && <ContactForm busy={busy} onSubmit={(contact) => void update((current) => screeningApi.submitContact(current.id, contact))} />}</section>}
            {session.stage === "completed" && <section className="screen-card report"><h2>Thank you</h2><p>Your screening details have been saved. DAS can follow up with {session.contact?.name} at {session.contact?.email}.</p></section>}
            {error && <p className="screen-error" role="alert">{error}</p>}
        </main>
    );
}

function ContactForm({ busy, onSubmit }: { busy: boolean; onSubmit: (details: ContactDetails) => void }) {
    const [details, setDetails] = useState<ContactDetails>({ name: "", email: "", phone: "" });
    return <form className="contact-form" onSubmit={(event) => { event.preventDefault(); onSubmit(details); }}>{(["name", "email", "phone"] as const).map((field) => <label key={field}>{field[0].toUpperCase() + field.slice(1)}<input type={field === "email" ? "email" : "text"} value={details[field]} onChange={(event) => setDetails({ ...details, [field]: event.target.value })} required /></label>)}<button disabled={busy}>Submit details</button></form>;
}

export function ScreeningApp() {
    const [type, setType] = useState<ScreenerType | null>(null);
    return <div>{type ? <ScreeningFlow type={type} onBack={() => setType(null)} /> : <main className="screen-home"><p className="screen-eyebrow">Start here</p><h1>A quiet first step toward understanding.</h1><p>Choose the screening guide that fits your situation. Your responses help create a useful summary for your next conversation with DAS.</p><div className="screen-options"><button onClick={() => setType("adult")}><strong>For myself</strong><span>Adult screening guide</span></button><button onClick={() => setType("child")}><strong>For a child</strong><span>Parent or caregiver guide</span></button></div><small>This is a screening tool, not a clinical assessment or diagnosis.</small></main>}</div>;
}
