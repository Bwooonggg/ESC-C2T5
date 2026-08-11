import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
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
//
// Presentational only — ProgressPage owns the fetch (via useProgress) and
// passes the records down, since the banner and stat cards need the same data.

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

export function ProgressChart({ records }: { records: ProgressRecord[] }) {
    const rows = toChartRows(records);
    const areas = presentSkillAreas(records);

    if (rows.length === 0) {
        return (
            <p className={styles.status}>
                There are no progress records for this child yet.
            </p>
        );
    }

    return (
        <div className={styles.chart}>
            {/* Legend rendered here, not via Recharts' <Legend>, so it can sit as
             * chips above the plot rather than below it. Same source data
             * (skillAreaColor/skillAreaDash) as the table's row keys, so the chip,
             * the line, and the table row can never disagree about which skill is
             * which. */}
            <div className={styles.legendRow}>
                {areas.map((area: SkillArea) => (
                    <span key={area} className={styles.legendChip}>
                        <span
                            className={styles.legendChipLine}
                            style={{
                                borderTopColor: skillAreaColor[area],
                                borderTopStyle: skillAreaDash[area] ? "dashed" : "solid",
                            }}
                            aria-hidden="true"
                        />
                        {area}
                    </span>
                ))}
            </div>

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
