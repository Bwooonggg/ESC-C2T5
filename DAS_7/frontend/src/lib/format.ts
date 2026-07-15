import type { ProgressRecord, SkillArea } from "../types/domain";

// Shared chart vocabulary: series order, colour, texture, and the shape change
// the chart needs. The legend and the table read from the same maps as the
// chart, so they can never disagree about which skill is which.

// Fixed order. Categorical hues are assigned by this order and never cycled or
// reassigned by rank — a reader who learns "Spelling is the dotted green one"
// must not have it repainted when the data changes.
export const SKILL_AREAS: SkillArea[] = [
    "Phonological Awareness",
    "Reading Accuracy",
    "Reading Fluency",
    "Spelling",
    "Writing",
    "Comprehension",
];

// CSS custom properties rather than hex, so light and dark are chosen in CSS
// (progressChart.module.css) instead of being computed in JS. var() does resolve
// inside an SVG `stroke` presentation attribute — verified in Chrome.
//
// Slots 1-6 of the validated categorical palette. Do not hand-edit these to
// "nicer" colours: the pairing passed a colourblindness check as a set
// (worst adjacent ΔE 24.2 light / 10.3 dark), and changing one breaks the set.
export const skillAreaColor: Record<SkillArea, string> = {
    "Phonological Awareness": "var(--series-1)",
    "Reading Accuracy": "var(--series-2)",
    "Reading Fluency": "var(--series-3)",
    Spelling: "var(--series-4)",
    Writing: "var(--series-5)",
    Comprehension: "var(--series-6)",
};

// Secondary encoding — this is why the chart is legible without colour.
//
// It is not decoration. Two slots fall below 3:1 contrast in light mode, and
// green/yellow sit at CVD ΔE 10.3 in dark mode; both are only acceptable when
// something other than hue distinguishes the series. Dashes are that something
// (the table below the chart is the other half).
export const skillAreaDash: Record<SkillArea, string | undefined> = {
    "Phonological Awareness": undefined, // solid
    "Reading Accuracy": "7 3",
    "Reading Fluency": "2 3",
    Spelling: "10 3 2 3",
    Writing: "12 4",
    Comprehension: "1 4",
};

// One row per date, one key per skill area — what Recharts' LineChart wants.
export type ChartRow = { date: string } & Partial<Record<SkillArea, number>>;

/**
 * Pivot progress records from long format to wide.
 *
 * The API returns one record per (skill area x date) — 18 per student. Recharts
 * needs one row per x-value with a key per series:
 *
 *   [{ date, skillArea: 'Spelling', score: 41 }, …]
 *     -> [{ date: '2026-01-20', Spelling: 41, Writing: 46, … }, …]
 *
 * Rows come out sorted by date, because the x-axis is time and the caller
 * should not have to remember to sort.
 */
export function toChartRows(records: ProgressRecord[]): ChartRow[] {
    const byDate = new Map<string, ChartRow>();

    for (const record of records) {
        let row = byDate.get(record.date);
        if (!row) {
            row = { date: record.date };
            byDate.set(record.date, row);
        }
        row[record.skillArea] = record.score;
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Which skill areas actually appear in the data, in SKILL_AREAS order.
 *
 * Drives the lines and the legend. Derived from the records rather than
 * assuming all six: a student missing an assessment should not get a phantom
 * empty series in the legend.
 */
export function presentSkillAreas(records: ProgressRecord[]): SkillArea[] {
    const present = new Set(records.map((record) => record.skillArea));
    return SKILL_AREAS.filter((area) => present.has(area));
}

/** e.g. '2026-01-20' -> '20 Jan 2026'. Axis ticks and table cells. */
export function formatDate(iso: string): string {
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}
