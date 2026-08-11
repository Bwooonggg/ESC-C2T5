import { useEffect, useState } from "react";
import { trackProgress } from "../api/client";
import type { ProgressRecord } from "../types/domain";

// Moved out of progressChart.tsx: the banner (latest assessment date) and the
// stat cards (score deltas) need the same records the chart plots, so the
// page fetches once and hands the result down instead of three components
// independently re-requesting the same data.

export type ProgressStatus =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "success"; records: ProgressRecord[] };

export function useProgress(studentId: string): ProgressStatus {
    const [status, setStatus] = useState<ProgressStatus>({ kind: "loading" });

    useEffect(() => {
        // `ignore` guards the race: switch student quickly and a slower earlier
        // response can land after a faster later one. Without this, the page
        // would show the wrong child's data.
        let ignore = false;

        setStatus({ kind: "loading" });

        trackProgress(studentId)
            .then((result) => {
                if (ignore) return;
                setStatus({ kind: "success", records: result.progress });
            })
            .catch((error: unknown) => {
                if (ignore) return;
                const message =
                    error instanceof Error ? error.message : "Unable to load progress.";
                console.error(`[useProgress] ${studentId}:`, message);
                setStatus({ kind: "error", message });
            });

        return () => {
            ignore = true;
        };
    }, [studentId]);

    return status;
}
