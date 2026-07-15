import {useEffect, useState} from "react";
import {getSummary, type SummaryResponse} from "../api/summaryApi";

export function SummaryComponent({studentId,}: {studentId:string;}) {
    const [data, setData] = useState<SummaryResponse | null>(null);

    // Run this when mounted
    useEffect(() => {
        async function loadSummary() {
            const result = await getSummary(studentId);
            setData(result);
        }

        loadSummary();
    }, [])

    return <section><p>{data?.content ?? "Unable to fetch"}</p></section>;
}