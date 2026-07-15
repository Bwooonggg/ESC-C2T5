import { useEffect, useState } from "react";
import { getSummary } from "../api/summaryApi";
import { type Summary } from "../types/domain";

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

    return <section><p>{data?.content ?? "Loading summary..."}</p></section>;
}
