import { useEffect, useState } from "react";
import { getSummary } from "../api/summaryApi";
import { type Summary } from "../types/domain";

export function SummaryComponent({ studentId, }: { studentId: string; }) {
    const [data, setData] = useState<Summary | null>(null);

    // Run this when mounted
    useEffect(() => {
        async function loadSummary() {
            const result = await getSummary(studentId);
            setData(result);
        }

        loadSummary();
    }, [])

    return <section><p>{data?.content ?? "Loading summary..."}</p></section>;
}