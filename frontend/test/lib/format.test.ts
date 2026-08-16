import {
    SKILL_AREAS,
    formatDate,
    presentSkillAreas,
    skillAreaColor,
    skillAreaDash,
    toChartRows,
} from "../../src/lib/format";
import type { ProgressRecord, SkillArea } from "../../src/types/domain";

// Builds records the way the mock backend seeds them: every skill area sampled
// on every date.
function seed(dates: string[], areas: SkillArea[] = SKILL_AREAS): ProgressRecord[] {
    const records: ProgressRecord[] = [];
    dates.forEach((date, dateIndex) => {
        areas.forEach((skillArea, areaIndex) => {
            records.push({
                recordId: `r-${dateIndex}-${areaIndex}`,
                studentId: "s1",
                date,
                skillArea,
                score: 40 + dateIndex * 7 + areaIndex,
                notes: "",
            });
        });
    });
    return records;
}

const DATES = ["2026-01-20", "2026-03-17", "2026-05-19"];

describe("toChartRows", () => {
    it("UT-LOGIN-U20-01 pivots a student's 18 records into 3 rows of 6 skill areas", () => {
        const rows = toChartRows(seed(DATES));

        // The real shape: 6 areas x 3 dates in, one row per date out.
        expect(rows).toHaveLength(3);
        for (const row of rows) {
            for (const area of SKILL_AREAS) {
                expect(typeof row[area]).toBe("number");
            }
        }
    });

    it("UT-LOGIN-U20-02 keys each row by date and carries the score across", () => {
        const rows = toChartRows([
            {
                recordId: "r1",
                studentId: "s1",
                date: "2026-01-20",
                skillArea: "Spelling",
                score: 41,
                notes: "",
            },
            {
                recordId: "r2",
                studentId: "s1",
                date: "2026-01-20",
                skillArea: "Writing",
                score: 46,
                notes: "",
            },
        ]);

        expect(rows).toEqual([{ date: "2026-01-20", Spelling: 41, Writing: 46 }]);
    });

    it("UT-LOGIN-U20-03 sorts rows by date even when records arrive out of order", () => {
        const shuffled = [...seed(DATES)].reverse();

        expect(toChartRows(shuffled).map((row) => row.date)).toEqual(DATES);
    });

    it("UT-LOGIN-U20-04 returns no rows for no records, rather than throwing", () => {
        // The empty state has to be representable — a student with no
        // assessments yet is a real case, not an error.
        expect(toChartRows([])).toEqual([]);
    });

    it("UT-LOGIN-U20-05 leaves a skill area undefined on dates it was not assessed", () => {
        const records = seed(["2026-01-20"], ["Spelling"]).concat(
            seed(["2026-03-17"], ["Writing"]),
        );

        const rows = toChartRows(records);

        expect(rows[0]).toEqual({ date: "2026-01-20", Spelling: 40 });
        expect(rows[1].Spelling).toBeUndefined();
    });
});

describe("presentSkillAreas", () => {
    it("UT-LOGIN-U21-01 returns areas in fixed SKILL_AREAS order, not the order records arrive", () => {
        const records = seed(["2026-01-20"], ["Comprehension", "Phonological Awareness"]);

        // Colour is assigned by this order, so it must not follow the data.
        expect(presentSkillAreas(records)).toEqual([
            "Phonological Awareness",
            "Comprehension",
        ]);
    });

    it("UT-LOGIN-U21-02 omits areas absent from the data, so the legend has no phantom series", () => {
        expect(presentSkillAreas(seed(DATES, ["Spelling"]))).toEqual(["Spelling"]);
    });
});

describe("series identity", () => {
    it("UT-LOGIN-U22-01 gives every skill area a colour and a dash slot", () => {
        for (const area of SKILL_AREAS) {
            expect(skillAreaColor[area]).toMatch(/^var\(--series-[1-6]\)$/);
            expect(Object.prototype.hasOwnProperty.call(skillAreaDash, area)).toBe(true);
        }
    });

    it("UT-LOGIN-U22-02 assigns a distinct colour slot per skill area", () => {
        const slots = SKILL_AREAS.map((area) => skillAreaColor[area]);

        expect(new Set(slots).size).toBe(SKILL_AREAS.length);
    });

    it("UT-LOGIN-U22-03 assigns a distinct dash pattern per skill area", () => {
        // This is the secondary encoding. If two series share a pattern AND sit
        // close in hue, colourblind readers cannot tell them apart.
        const dashes = SKILL_AREAS.map((area) => skillAreaDash[area]);

        expect(new Set(dashes).size).toBe(SKILL_AREAS.length);
    });
});

describe("formatDate", () => {
    it("UT-LOGIN-U23-01 renders an ISO date readably", () => {
        expect(formatDate("2026-01-20")).toBe("20 Jan 2026");
    });

    it("UT-LOGIN-U23-02 passes through anything unparseable instead of showing 'Invalid Date'", () => {
        expect(formatDate("not-a-date")).toBe("not-a-date");
    });
});
