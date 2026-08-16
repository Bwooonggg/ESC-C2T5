import { useEffect, useState } from "react";
import { getSummary } from "../api/summaryApi";
import { formatDate } from "../lib/format";
import { type Summary } from "../types/domain";
import styles from "./summaryComponent.module.css";

export function SummaryComponent({ studentId, }: { studentId: string; }) {
    const [data, setData] = useState<Summary | null>(null);

    useEffect(() => {
        let cancelled = false;
        setData(null);

        async function loadSummary() {
            try {
                const result = await getSummary(studentId);
                if (!cancelled) setData(result);
            } catch {
                if (!cancelled) setData(null);
            }
        }

        void loadSummary();

        return () => {
            cancelled = true;
        };
    }, [studentId]);

    return (
        <section className={styles.card}>
            <div className={styles.headerRow}>
                <h2 className={styles.heading}>Summary</h2>
                {data && (
                    <p className={styles.date}>{formatDate(data.generatedAt.slice(0, 10))}</p>
                )}
            </div>
            <p className={styles.body}>{data?.content ?? "Loading summary..."}</p>
        </section>
    );
}
