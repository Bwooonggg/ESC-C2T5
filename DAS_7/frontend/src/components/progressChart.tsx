import { useEffect, useState } from "react";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { trackProgress } from "../api/client";
import {
    formatDate,
    presentSkillAreas,
    skillAreaColor,
    skillAreaDash,
    toChartRows,
} from "../lib/format";
import type { ProgressRecord, SkillArea } from "../types/domain";
import styles from "./progressChart.module.css";

// Progress over time, one line per skill area.
//
// Identity never rests on colour alone: every series also has its own dash
// pattern, and the same numbers appear in the table below. That is a hard
// requirement, not polish — two of the six hues fall below 3:1 contrast in light
// mode, and two more sit at the colourblind-separation floor in dark mode.

type Status =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "success"; records: ProgressRecord[] };

type TooltipEntry = { name?: string; value?: number; color?: string };

function ChartTooltip({
    active,
    label,
    payload,
}: {
    active?: boolean;
    label?: string;
    payload?: TooltipEntry[];
}) {
    if (!active || !payload?.length) return null;

    return (
        <div className={styles.tooltip}>
            <p className={styles.tooltipDate}>{formatDate(String(label))}</p>
            <ul className={styles.tooltipList}>
                {payload.map((entry) => (
                    <li key={entry.name} className={styles.tooltipRow}>
                        <span
                            className={styles.swatch}
                            style={{ background: entry.color }}
                            aria-hidden="true"
                        />
                        {entry.name}: {entry.value}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function ProgressChart({ studentId }: { studentId: string }) {
    const [status, setStatus] = useState<Status>({ kind: "loading" });

    useEffect(() => {
        // `ignore` guards the race: switch student quickly and a slower earlier
        // response can land after a faster later one. Without this, the chart
        // would show the wrong child's data. It is also what makes StrictMode's
        // deliberate double-invoke in dev harmless.
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
                // Keep the real reason reachable for whoever is debugging; the UI
                // deliberately does not show it.
                console.error(`[ProgressChart] ${studentId}:`, message);
                setStatus({ kind: "error", message });
            });

        return () => {
            ignore = true;
        };
        // studentId belongs here: without it the effect would keep serving the
        // first student forever.
    }, [studentId]);

    if (status.kind === "loading") {
        return (
            <p className={styles.status} aria-busy="true">
                Loading progress…
            </p>
        );
    }

    if (status.kind === "error") {
        // The audience is a parent, not us. Every failure here reads the same to
        // them — the data did not arrive — so say that, once, in plain words.
        // The raw message ("progressUnavailable" from the sequence diagram, or
        // "non-JSON response (502)" when the backend is down) is diagnostic
        // detail: useful in the console, meaningless and alarming on the page.
        return (
            <p className={styles.error} role="alert">
                We could not load this progress right now. Please try again at another time.
            </p>
        );
    }

    const rows = toChartRows(status.records);
    const areas = presentSkillAreas(status.records);

    if (rows.length === 0) {
        return (
            <p className={styles.status}>
                There are no progress records for this child yet.
            </p>
        );
    }

    return (
        <div className={styles.chart}>
            <div className={styles.plot}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                        <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatDate}
                            stroke="var(--axis)"
                            tickMargin={8}
                        />
                        <YAxis
                            domain={[0, 100]}
                            stroke="var(--axis)"
                            tickMargin={8}
                            label={{
                                value: "Score",
                                angle: -90,
                                position: "insideLeft",
                                fill: "var(--axis)",
                            }}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        {/* Recharts colours legend text by series. Override it: the
                         * swatch carries identity, the text stays in ink. Series hues
                         * are tuned for 2px strokes, not for text — "Reading Fluency"
                         * in yellow is 2.11:1 on white, which is unreadable. */}
                        <Legend
                            formatter={(value: string) => (
                                <span className={styles.legendText}>{value}</span>
                            )}
                        />
                        {areas.map((area: SkillArea) => (
                            <Line
                                key={area}
                                type="monotone"
                                dataKey={area}
                                name={area}
                                stroke={skillAreaColor[area]}
                                strokeDasharray={skillAreaDash[area]}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                                connectNulls
                                // Not cosmetic: Recharts' line-draw animation works BY
                                // animating stroke-dasharray, so it overwrites the dash
                                // patterns above — the secondary encoding this chart's
                                // accessibility depends on. Leave this off.
                                isAnimationActive={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <caption>
                        The same scores as the chart above, as a table.
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">Skill area</th>
                            {rows.map((row) => (
                                <th key={row.date} scope="col">
                                    {formatDate(row.date)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {areas.map((area) => (
                            <tr key={area}>
                                <th scope="row">
                                    <span className={styles.rowKey}>
                                        <span
                                            className={styles.rowKeyLine}
                                            style={{
                                                borderTopColor: skillAreaColor[area],
                                                borderTopStyle: skillAreaDash[area]
                                                    ? "dashed"
                                                    : "solid",
                                            }}
                                            aria-hidden="true"
                                        />
                                        {area}
                                    </span>
                                </th>
                                {rows.map((row) => (
                                    <td key={`${area}-${row.date}`}>{row[area] ?? "—"}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
