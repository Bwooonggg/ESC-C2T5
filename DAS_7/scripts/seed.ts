/**
 * Seeds the primary DAS7 demonstration dataset.
 *
 *     npm run seed
 *
 * Every row has a fixed UUID and is written with `upsert`, so repeated runs
 * refresh the same records instead of creating duplicates. The script touches
 * only tables in the configured DAS7 schema.
 */
import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { createDbClient } from '../src/repos/db.js';
import { SKILL_AREAS } from '../src/types.js';

const PARENT_ID = 'd7000000-0000-4000-8000-000000000001';
const RECIPIENT_EMAIL = 'parent.demo@dial.sg';

const STUDENTS = [
    {
        studentId: 'd7000000-0000-4000-8000-000000000101',
        name: 'Nur Hakim',
        dateOfBirth: '2015-04-12',
        bandLevel: 'Band A',
    },
    {
        studentId: 'd7000000-0000-4000-8000-000000000102',
        name: 'Elias Rahman',
        dateOfBirth: '2013-11-02',
        bandLevel: 'Band B',
    },
    {
        studentId: 'd7000000-0000-4000-8000-000000000103',
        name: 'Sofia Rahman',
        dateOfBirth: '2016-08-23',
        bandLevel: 'Band A',
    },
] as const;

const ASSESSMENT_DATES = [
    '2026-01-20',
    '2026-03-17',
    '2026-05-19',
    '2026-06-23',
    '2026-07-21',
    '2026-08-11',
] as const;

/** Scores are ordered by student, assessment date, then SKILL_AREAS. */
const SCORES: readonly (readonly (readonly number[])[])[] = [
    [
        [45, 47, 49, 51, 53, 55],
        [56, 58, 60, 62, 64, 66],
        [67, 69, 71, 73, 75, 77],
        [72, 66, 74, 75, 73, 80],
        [70, 72, 73, 78, 77, 79],
        [76, 75, 78, 76, 82, 84],
    ],
    [
        [49, 51, 53, 55, 57, 59],
        [60, 62, 64, 66, 68, 70],
        [71, 73, 75, 77, 79, 81],
        [69, 76, 78, 75, 82, 80],
        [74, 74, 77, 81, 80, 84],
        [78, 79, 76, 83, 85, 82],
    ],
    [
        [53, 55, 57, 59, 61, 63],
        [64, 66, 68, 70, 72, 74],
        [75, 77, 79, 81, 83, 85],
        [79, 75, 82, 84, 81, 87],
        [78, 80, 81, 82, 86, 86],
        [83, 82, 85, 80, 88, 90],
    ],
];

const INITIAL_NOTES = [
    'Baseline for the term; needs prompting.',
    'More consistent, still slow under time pressure.',
    'Working independently on most tasks now.',
] as const;

interface ProgressSeedRow {
    record_id: string;
    student_id: string;
    date: string;
    skill_area: string;
    score: number;
    notes: string;
}

function progressId(studentIndex: number, skillIndex: number, roundIndex: number): string {
    const numericId = roundIndex < INITIAL_NOTES.length
        ? 200000 + studentIndex * 18 + skillIndex * 3 + roundIndex
        : 300000 + studentIndex * 18 + (roundIndex - INITIAL_NOTES.length) * 6 + skillIndex;
    return `d7000000-0000-4000-8000-${String(numericId).padStart(12, '0')}`;
}

function progressNote(
    studentIndex: number,
    skillIndex: number,
    roundIndex: number,
): string {
    const skillArea = SKILL_AREAS[skillIndex];
    if (roundIndex < INITIAL_NOTES.length) {
        return `${skillArea}: ${INITIAL_NOTES[roundIndex]}`;
    }

    const current = SCORES[studentIndex][roundIndex][skillIndex];
    const previous = SCORES[studentIndex][roundIndex - 1][skillIndex];
    const change = current - previous;

    if (change <= -2) {
        return `${skillArea}: Temporary dip; performance was less consistent in this assessment.`;
    }
    if (change <= 0) {
        return `${skillArea}: Holding steady with minor day-to-day variation.`;
    }
    if (change >= 4) {
        return `${skillArea}: Strong improvement; applying strategies more independently.`;
    }
    return `${skillArea}: Gradual improvement with occasional prompting.`;
}

function buildProgressRows(): ProgressSeedRow[] {
    const rows: ProgressSeedRow[] = [];
    STUDENTS.forEach((student, studentIndex) => {
        ASSESSMENT_DATES.forEach((date, roundIndex) => {
            SKILL_AREAS.forEach((skillArea, skillIndex) => {
                rows.push({
                    record_id: progressId(studentIndex, skillIndex, roundIndex),
                    student_id: student.studentId,
                    date,
                    skill_area: skillArea,
                    score: SCORES[studentIndex][roundIndex][skillIndex],
                    notes: progressNote(studentIndex, skillIndex, roundIndex),
                });
            });
        });
    });
    return rows;
}

async function main(): Promise<void> {
    const authUserId = (process.env.SEED_AUTH_USER_ID ?? '').trim();
    if (authUserId === '') {
        throw new Error(
            'SEED_AUTH_USER_ID is required and must identify an existing Supabase Auth user.',
        );
    }

    const config = loadConfig();
    const client = createDbClient(config);

    const parent = await client
        .from('parents')
        .upsert({
            parent_id: PARENT_ID,
            auth_user_id: authUserId,
            name: 'Aisha Rahman',
            email: RECIPIENT_EMAIL,
            mobile_number: '+65 8123 4567',
        }, { onConflict: 'parent_id' });
    if (parent.error) throw new Error(`seed: parents — ${parent.error.message}`);

    const students = await client
        .from('students')
        .upsert(STUDENTS.map((student) => ({
            student_id: student.studentId,
            name: student.name,
            date_of_birth: student.dateOfBirth,
            band_level: student.bandLevel,
        })), { onConflict: 'student_id' });
    if (students.error) throw new Error(`seed: students — ${students.error.message}`);

    const links = await client
        .from('parent_students')
        .upsert(STUDENTS.map((student) => ({
            parent_id: PARENT_ID,
            student_id: student.studentId,
        })), { onConflict: 'parent_id,student_id' });
    if (links.error) throw new Error(`seed: parent_students — ${links.error.message}`);

    const progressRows = buildProgressRows();
    const progress = await client
        .from('progress_records')
        .upsert(progressRows, { onConflict: 'record_id' });
    if (progress.error) throw new Error(`seed: progress_records — ${progress.error.message}`);

    const preference = await client
        .from('notification_preferences')
        .upsert({
            parent_id: PARENT_ID,
            enabled: true,
            frequency: 'Weekly',
            recipient_email: RECIPIENT_EMAIL,
        }, { onConflict: 'parent_id' });
    if (preference.error) {
        throw new Error(`seed: notification_preferences — ${preference.error.message}`);
    }

    console.log('Seed complete:');
    console.log('  parents                   1 (Aisha Rahman)');
    console.log(`  students                  ${STUDENTS.length}`);
    console.log(`  parent_students           ${STUDENTS.length}`);
    console.log(`  progress_records          ${progressRows.length}`);
    console.log(`  notification_preferences  1 (Weekly → ${RECIPIENT_EMAIL})`);
    console.log('Summaries, recommendations, and notifications are generated on demand.');
}

main().catch((error: unknown) => {
    console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
