import type { Worksheet } from "./utils";

export function WorksheetPreview({ worksheet, showAnswers }: { worksheet: Worksheet | null; showAnswers: boolean }) {
    if (!worksheet) return <div className="worksheet-empty"><div aria-hidden="true">✦</div><h2>Your worksheet will appear here</h2><p>Tell the assistant a topic, Band A/B/C, and whether you prefer MCQ or open-ended questions.</p></div>;
    return <article className="worksheet-document"><header><p>DAS learning activity</p><h1>{worksheet.title ?? worksheet.topic ?? "Literacy Worksheet"}</h1>{worksheet.instructions && <p>{worksheet.instructions}</p>}</header><ol>{worksheet.questions.map((item, index) => <li key={index}><p>{item.question ?? item.text ?? `Question ${index + 1}`}</p>{item.options?.map((option) => <div className="worksheet-option" key={option}>○ {option}</div>)}{!item.options?.length && <div className="answer-line" />}{showAnswers && <p className="answer-key">Answer: {item.answer ?? item.correct_answer ?? "Teacher review"}</p>}</li>)}</ol></article>;
}
