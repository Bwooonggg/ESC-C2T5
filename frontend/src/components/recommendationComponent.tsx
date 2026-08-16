import { useState } from "react";
import type { Recommendation } from "../types/domain";
import { getRecommendation } from "../api/recommendationApi";
import styles from "./recommendationComponent.module.css";

// "What you can do at home" — suggestions generated from the student's
// summary, on demand rather than automatically, since generation calls the
// LLM adapter and the parent may not want one on every visit.

export function RecommendationComponent({ studentId }: { studentId: string }) {
    const [data, setData] = useState<Recommendation | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleGenerate() {
        setLoading(true);
        setError(null);

        try {
            const result = await getRecommendation(studentId);
            setData(result);
        } catch (requestError) {
            setData(null);
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Unable to generate recommendations.",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className={styles.card}>
            <h2 className={styles.heading}>What you can do at home</h2>

            {data ? (
                <p className={styles.body}>{data.content}</p>
            ) : (
                <p className={styles.placeholder}>
                    Suggestions are written from the summary when you ask for them.
                </p>
            )}

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button
                type="button"
                className={styles.button}
                onClick={handleGenerate}
                disabled={loading}
            >
                {loading ? "Generating…" : "Get suggestions"}
            </button>
        </section>
    );
}
