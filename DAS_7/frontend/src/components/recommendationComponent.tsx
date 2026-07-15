import { useState } from "react";
import type { Recommendation } from "../types/domain";
import { getRecommendation } from "../api/recommendationApi";

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
        <section>
            <button type="button" onClick={handleGenerate} disabled={loading}>
                {loading ? "Generating..." : "Generate Recommendations!"}
            </button>

            {error && <p role="alert">{error}</p>}

            {data && (
                <article>
                    <h2>Recommendation</h2>
                    <p>{data.content}</p>
                </article>
            )}
        </section>
    );
}

