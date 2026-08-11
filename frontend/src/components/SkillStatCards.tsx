import { computeSkillDeltas, presentSkillAreas, skillAreaColor, skillAreaDash } from "../lib/format";
import type { ProgressRecord } from "../types/domain";
import styles from "./SkillStatCards.module.css";

export function SkillStatCards({ records }: { records: ProgressRecord[] }) {
    const areas = presentSkillAreas(records);
    const deltas = computeSkillDeltas(records);

    if (areas.length === 0) return null;

    return (
        <div className={styles.grid}>
            {areas.map((area) => {
                const stat = deltas[area];
                if (!stat) return null;

                const direction = stat.delta > 0 ? "up" : stat.delta < 0 ? "down" : "flat";
                const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
                const deltaClass =
                    direction === "up"
                        ? styles.deltaUp
                        : direction === "down"
                          ? styles.deltaDown
                          : styles.deltaFlat;

                return (
                    <div key={area} className={styles.card}>
                        <p className={styles.label}>
                            <span
                                className={styles.labelLine}
                                style={{
                                    borderTopColor: skillAreaColor[area],
                                    borderTopStyle: skillAreaDash[area] ? "dashed" : "solid",
                                }}
                                aria-hidden="true"
                            />
                            {area}
                        </p>
                        <p className={styles.score}>{stat.latest}</p>
                        <p className={`${styles.delta} ${deltaClass}`}>
                            {arrow} {Math.abs(stat.delta)} {stat.sinceLabel}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
