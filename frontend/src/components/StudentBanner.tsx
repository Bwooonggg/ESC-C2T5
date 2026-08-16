import { calculateAge, formatDate } from "../lib/format";
import type { Student } from "../types/domain";
import styles from "./StudentBanner.module.css";

export function StudentBanner({
    student,
    students,
    latestAssessmentDate,
    onSelect,
}: {
    student: Student;
    students: Student[];
    /** ISO date of the most recent progress record, or null while loading. */
    latestAssessmentDate: string | null;
    onSelect: (studentId: string) => void;
}) {
    return (
        <section className={styles.banner}>
            <div className={styles.identity}>
                <div className={styles.studentHeading}>
                    <p className={styles.eyebrow}>Student progress record</p>
                    <h1 className={styles.name}>{student.name}</h1>
                </div>
                <div className={styles.meta}>
                    <div>
                        <p className={styles.metaLabel}>Band</p>
                        <p className={styles.metaValue}>{student.bandLevel}</p>
                    </div>
                    <div>
                        <p className={styles.metaLabel}>Age</p>
                        <p className={styles.metaValue}>{calculateAge(student.dateOfBirth)}</p>
                    </div>
                    <div>
                        <p className={styles.metaLabel}>Latest assessment</p>
                        <p className={styles.metaValue}>
                            {latestAssessmentDate ? formatDate(latestAssessmentDate) : "—"}
                        </p>
                    </div>
                </div>
            </div>

            {students.length > 1 && (
                <div className={styles.picker}>
                    <label htmlFor="student-select" className={styles.pickerLabel}>
                        Child
                    </label>
                    <select
                        id="student-select"
                        value={student.studentId}
                        onChange={(event) => onSelect(event.target.value)}
                    >
                        {students.map((option) => (
                            <option key={option.studentId} value={option.studentId}>
                                {option.name} · {option.bandLevel}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </section>
    );
}
