import { ProgressChart } from "../components/progressChart";
import { RecommendationComponent } from "../components/recommendationComponent";
import { SkillStatCards } from "../components/SkillStatCards";
import { StudentBanner } from "../components/StudentBanner";
import { SummaryComponent } from "../components/summaryComponent";
import { useProgress } from "../hooks/useProgress";
import type { Student } from "../types/domain";
import styles from "./ProgressPage.module.css";

export function ProgressPage({
    student,
    students,
    onSelectStudent,
}: {
    student: Student;
    students: Student[];
    onSelectStudent: (studentId: string) => void;
}) {
    const status = useProgress(student.studentId);

    const records = status.kind === "success" ? status.records : [];
    const assessmentDates = new Set(records.map((record) => record.date));
    const sortedDates = [...assessmentDates].sort();
    const latestAssessmentDate =
        sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
    const assessmentCount = assessmentDates.size;

    return (
        <div className={styles.page}>
            <StudentBanner
                student={student}
                students={students}
                latestAssessmentDate={latestAssessmentDate}
                onSelect={onSelectStudent}
            />

            {status.kind === "loading" && <p aria-busy="true">Loading progress…</p>}

            {status.kind === "error" && (
                <p role="alert">
                    We could not load this progress right now. Please try again at another time.
                </p>
            )}

            {status.kind === "success" && (
                <>
                    <SkillStatCards records={records} />

                    <div className={styles.columns}>
                        <div className={styles.chartCard}>
                            <div className={styles.chartHeaderRow}>
                                <h2 className={styles.chartHeading}>Progress over time</h2>
                                <p className={styles.chartMeta}>
                                    {assessmentCount} assessment{assessmentCount === 1 ? "" : "s"}{" "}
                                    · scores out of 100
                                </p>
                            </div>
                            <ProgressChart records={records} />
                        </div>

                        <div className={styles.sidebar}>
                            <SummaryComponent
                                key={student.studentId}
                                studentId={student.studentId}
                            />
                            <RecommendationComponent
                                key={`rec-${student.studentId}`}
                                studentId={student.studentId}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
