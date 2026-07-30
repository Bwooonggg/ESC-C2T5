/**
 * Seeds the demo dataset for the DAS 7 Parent Insight Dashboard.
 *
 *     npm run seed
 *
 * Every row has a fixed UUID and is written with `upsert`, so running this more
 * than once refreshes the demo data instead of duplicating it. It only ever
 * touches the `insight` schema's own tables.
 */
import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { createDbClient } from '../src/repos/db.js';
import { SKILL_AREAS } from '../src/types.js';

const PARENT_ID = 'd7000000-0000-4000-8000-000000000001';

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
];

const ASSESSMENT_DATES = ['2026-01-20', '2026-03-17', '2026-05-19'];

/** One note per assessment round, phrased as a therapist would write it. */
const NOTE_BY_ROUND = [
    'Baseline for the term; needs prompting.',
    'More consistent, still slow under time pressure.',
    'Working independently on most tasks now.',
];

const RECIPIENT_EMAIL = 'parent.demo@dial.sg';

/** Stable UUIDs for generated rows so re-seeding overwrites the same records. */
function progressId(index: number): string {
    return `d7000000-0000-4000-8000-${String(200000 + index).padStart(12, '0')}`;
}

/**
 * Deterministic 40–95 score that rises across the three rounds: students and
 * skill areas each get a small fixed offset, the round adds the improvement.
 */
function scoreFor(studentIndex: number, skillIndex: number, roundIndex: number): number {
    return 45 + studentIndex * 4 + skillIndex * 2 + roundIndex * 11;
}

interface ProgressSeedRow {
    record_id: string;
    student_id: string;
    date: string;
    skill_area: string;
    score: number;
    notes: string;
}

function buildProgressRows(): ProgressSeedRow[] {
    const rows: ProgressSeedRow[] = [];
    STUDENTS.forEach((student, studentIndex) => {
        SKILL_AREAS.forEach((skillArea, skillIndex) => {
            ASSESSMENT_DATES.forEach((date, roundIndex) => {
                rows.push({
                    record_id: progressId(rows.length),
                    student_id: student.studentId,
                    date,
                    skill_area: skillArea,
                    score: scoreFor(studentIndex, skillIndex, roundIndex),
                    notes: `${skillArea}: ${NOTE_BY_ROUND[roundIndex]}`,
                });
            });
        });
    });
    return rows;
}

async function main(): Promise<void> {
    // loadConfig throws when these are missing, but a bare stack trace is a poor
    // first experience for whoever is setting the project up.
    for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
        if ((process.env[key] ?? '').trim() === '') {
            throw new Error(
                `${key} is not set. Copy .env.example to .env and fill in the Supabase `
                + 'project URL and service_role key before seeding.',
            );
        }
    }

    const config = loadConfig();
    const client = createDbClient(config);

    const authUserId = (process.env.SEED_AUTH_USER_ID ?? '').trim() || null;
    if (authUserId === null) {
        console.log(
            'SEED_AUTH_USER_ID not set — seeding the parent with auth_user_id = null. '
            + 'Set it to the Supabase auth user id of the demo login and re-run to link them.',
        );
    } else {
        console.log(`Linking the demo parent to auth user ${authUserId}.`);
    }

    console.log(`Seeding schema "${config.supabaseDbSchema}" at ${config.supabaseUrl} …`);

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

    console.log('\nSeed complete:');
    console.log(`  parents                   1 (Aisha Rahman)`);
    console.log(`  students                  ${STUDENTS.length}`);
    console.log(`  parent_students           ${STUDENTS.length}`);
    console.log(`  progress_records          ${progressRows.length}`);
    console.log(`  notification_preferences  1 (Weekly → ${RECIPIENT_EMAIL})`);
    console.log('\nSummaries, recommendations and email notifications are left empty — '
        + 'the app generates those on demand.');
}

main().catch((error: unknown) => {
    console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
