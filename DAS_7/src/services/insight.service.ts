import type { Deps, InsightService } from '../deps.js';
import { NotFoundError, UnavailableError } from '../errors.js';
import type { ProgressRecord, Recommendation, Student, Summary } from '../types.js';

// get only relevant dependency proprties
type InsightDeps = Pick<
    Deps,
    'studentRepo' | 'progressRepo' | 'summaryRepo' | 'recommendationRepo' | 'llm'
>;

export function createInsightService(deps: InsightDeps): InsightService {
    const { studentRepo, progressRepo, summaryRepo, recommendationRepo, llm } = deps;

    /** Defense in depth: the routes already checked guardianship. */
    async function requireStudent(studentId: string): Promise<Student> {
        const student = await studentRepo.byId(studentId);
        if (!student) throw new NotFoundError('progressUnavailable');
        return student;
    }

    /**
     * The shared core: the stored summary if it still covers every progress record,
     * otherwise a freshly generated and stored one.
     */
    async function getSummary(studentId: string): Promise<Summary> {
        const student = await requireStudent(studentId);

        const records = await progressRepo.listByStudent(studentId);
        if (records.length === 0) throw new UnavailableError('progressUnavailable');

        const latest = await summaryRepo.latestByStudent(studentId);
        const newest = await progressRepo.latestCreatedAt(studentId);
        // true if no summary/newest progress date supersedes the newest summary date
        const stale = !latest
            || (newest !== null && Date.parse(newest) > Date.parse(latest.generatedAt));
        if (!stale) return latest;

        let content: string;
        try {
            content = await llm.generateSummary({ student, records });
        } catch (err) {
            // The 503 body deliberately says nothing about why; the operator still needs to
            // know, so the real cause is logged here rather than discarded.
            console.error(`[insight] summary generation failed for student ${studentId}:`, err);
            // Thrown before the insert below, so a failed generation stores nothing.
            throw new UnavailableError('summaryUnavailable');
        }

        return summaryRepo.insert({ studentId, content });
    }

    async function trackProgress(
        studentId: string,
    ): Promise<{ progress: ProgressRecord[]; summary: Summary }> {
        // Loading progress twice keeps this readable; the second read is cheap.
        const summary = await getSummary(studentId);
        const progress = await progressRepo.listByStudent(studentId);
        return { progress, summary };
    }

    /** Works off the stored summary only — never triggers summary generation. */
    async function createRecommendation(studentId: string): Promise<Recommendation> {
        const student = await requireStudent(studentId);

        const latest = await summaryRepo.latestByStudent(studentId);
        if (!latest) throw new NotFoundError('summaryUnavailable');

        let content: string;
        try {
            content = await llm.generateRecommendation({ student, summary: latest });
        } catch (err) {
            console.error(`[insight] recommendation generation failed for student ${studentId}:`, err);
            throw new UnavailableError('recommendationUnavailable');
        }

        return recommendationRepo.insert({ summaryId: latest.summaryId, content });
    }

    return { trackProgress, getSummary, createRecommendation };
}
