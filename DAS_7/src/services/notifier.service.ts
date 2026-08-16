import type { Deps, NotifierService, NotifyOutcome } from '../deps.js';
import type { NotificationFrequency, Summary } from '../types.js';

/** True when no email was ever sent, or the frequency interval has fully elapsed. */
export function isDue(
    lastSentAt: string | null,
    frequency: NotificationFrequency,
    now: Date,
    intervals: Record<NotificationFrequency, number>,
): boolean {
    if (lastSentAt === null) return true;
    const last = Date.parse(lastSentAt);
    if (Number.isNaN(last)) return true;
    return now.getTime() - last >= intervals[frequency];
}

type NotifierDeps = Pick<Deps,
    'preferenceRepo' | 'parentRepo' | 'studentRepo' | 'emailNotificationRepo'
    | 'insightService' | 'email' | 'config'>;

export function createNotifierService(deps: NotifierDeps): NotifierService {
    const {
        preferenceRepo, parentRepo, studentRepo, emailNotificationRepo,
        insightService, email, config,
    } = deps;

    async function notifyParent(parentId: string, _now: Date): Promise<NotifyOutcome> {
        try {
            const pref = await preferenceRepo.byParentId(parentId);
            if (pref === null) throw new Error('no notification preference');
            if (!pref.enabled) throw new Error('notifications disabled');

            const parent = await parentRepo.byId(parentId);
            if (parent === null) throw new Error('parent not found');

            const students = await studentRepo.listByParent(parentId);
            if (students.length === 0) throw new Error('parent has no students');

            // Sequential on purpose: one failing student fails the whole
            // notification, and the insight service persists what it generates.
            const summaries: Summary[] = [];
            for (const student of students) {
                summaries.push(await insightService.getSummary(student.studentId));
            }

            const subject = `Progress update for ${students.map(s => s.name).join(', ')}`;
            const body = students
                .map((student, i) => `${student.name}:\n${summaries[i].content}`)
                .join('\n\n');

            // Send first, record second — a failed send leaves no row behind.
            await email.send({ to: pref.recipientEmail, subject, body });

            try {
                await emailNotificationRepo.insert({
                    parentId,
                    summaryId: summaries[0]?.summaryId ?? null,
                    recipientEmail: pref.recipientEmail,
                    subject,
                    body,
                });
            } catch (err) {
                // The email did go out; losing the record must not un-send it.
                console.error(
                    `[notifier] email sent but notification record failed for parent ${parentId}:`, err,
                );
            }

            return 'parentNotified';
        } catch (err) {
            console.error(`[notifier] notification failed for parent ${parentId}:`, err);
            return 'notificationFailed';
        }
    }

    async function runDueNotifications(
        now: Date,
    ): Promise<Array<{ parentId: string; outcome: NotifyOutcome }>> {
        const prefs = await preferenceRepo.listEnabled();
        const results: Array<{ parentId: string; outcome: NotifyOutcome }> = [];

        for (const pref of prefs) {
            // Deliberately outside a try/catch: the never-throws guarantee lives in
            // notifyParent, not here. A repo-level failure on this read therefore ends
            // the sweep and skips the remaining parents until the next tick.
            const lastSent = await emailNotificationRepo.lastSentAt(pref.parentId);
            if (!isDue(lastSent, pref.frequency, now, config.notifyIntervalsMs)) continue;
            // notifyParent never throws, so one bad parent can't stop the sweep.
            results.push({ parentId: pref.parentId, outcome: await notifyParent(pref.parentId, now) });
        }

        return results;
    }

    return { notifyParent, runDueNotifications };
}
