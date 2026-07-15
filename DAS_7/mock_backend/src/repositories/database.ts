import type {
  NotificationPreference,
  Parent,
  ProgressRecord,
  Recommendation,
  SkillArea,
  Student,
  Summary,
} from '../types/domain.js'

// All data access goes through the Database interface below. Nothing above this
// file knows the data is hardcoded, so dropping in a real MySQL implementation
// is a matter of writing a second class and changing the export on the last line.
//
// The entity shapes already map to the intended tables:
//   parents, students, progress_records, summaries, recommendations,
//   email_notifications, notification_preferences

export interface Database {
  getParent(parentId: string): Parent | undefined
  getDefaultParent(): Parent
  getStudentsForParent(parentId: string): Student[]
  getStudent(studentId: string): Student | undefined
  getProgressRecords(studentId: string): ProgressRecord[]
  getLatestSummary(studentId: string): Summary | undefined
  saveSummary(summary: Summary): Summary
  getRecommendationForSummary(summaryId: string): Recommendation | undefined
  saveRecommendation(recommendation: Recommendation): Recommendation
  getPreferences(parentId: string): NotificationPreference | undefined
  savePreferences(prefs: NotificationPreference): NotificationPreference
  getAllPreferences(): NotificationPreference[]
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
//
// Entirely fictional. `parent.demo@dial.sg` is not a real mailbox and no real
// DAS student data appears anywhere in this file.

const SKILL_AREAS: SkillArea[] = [
  'Phonological Awareness',
  'Reading Accuracy',
  'Reading Fluency',
  'Spelling',
  'Writing',
  'Comprehension',
]

const PARENT: Parent = {
  parentId: 'p1',
  name: 'Aisha Rahman',
  email: 'parent.demo@dial.sg',
  mobileNumber: '+65 8123 4567',
  studentIds: ['s1', 's2', 's3'],
}

const STUDENTS: Student[] = [
  { studentId: 's1', name: 'Nur Hakim', dateOfBirth: '2015-04-12', bandLevel: 'Band A' },
  { studentId: 's2', name: 'Elias Rahman', dateOfBirth: '2013-09-30', bandLevel: 'Band B' },
  { studentId: 's3', name: 'Sofia Rahman', dateOfBirth: '2016-01-08', bandLevel: 'Band A' },
]

// Three dated snapshots per skill area per student (6 x 3 x 3 = 54 records).
// Each series trends upward but takes one dip in the middle sample, so the
// dashboard chart shows a real shape instead of six straight lines.
const SNAPSHOT_DATES = ['2026-01-20', '2026-03-17', '2026-05-19']

const BASE_SCORES: Record<string, Record<SkillArea, number>> = {
  s1: {
    'Phonological Awareness': 52, 'Reading Accuracy': 48, 'Reading Fluency': 44,
    Spelling: 41, Writing: 46, Comprehension: 55,
  },
  s2: {
    'Phonological Awareness': 64, 'Reading Accuracy': 61, 'Reading Fluency': 58,
    Spelling: 55, Writing: 60, Comprehension: 66,
  },
  s3: {
    'Phonological Awareness': 45, 'Reading Accuracy': 43, 'Reading Fluency': 39,
    Spelling: 38, Writing: 42, Comprehension: 47,
  },
}

// Which skill area dips at the middle snapshot, per student. One dip each.
const DIP_AREA: Record<string, SkillArea> = {
  s1: 'Spelling',
  s2: 'Reading Fluency',
  s3: 'Writing',
}

const NOTES_BY_STEP = [
  'Baseline check at the start of the term.',
  'Mid-term review with the educational therapist.',
  'Latest session — most recent snapshot.',
]

function buildProgressRecords(): ProgressRecord[] {
  const records: ProgressRecord[] = []

  for (const student of STUDENTS) {
    for (const skillArea of SKILL_AREAS) {
      const base = BASE_SCORES[student.studentId]![skillArea]

      SNAPSHOT_DATES.forEach((date, step) => {
        // Steady climb of ~7 points per snapshot...
        let score = base + step * 7
        // ...except the one area that dips at the middle snapshot before recovering.
        if (step === 1 && DIP_AREA[student.studentId] === skillArea) {
          score = base - 4
        }
        score = Math.max(0, Math.min(100, score))

        records.push({
          recordId: `${student.studentId}-${skillArea.replace(/\s+/g, '-').toLowerCase()}-${step}`,
          studentId: student.studentId,
          date,
          skillArea,
          score,
          notes: NOTES_BY_STEP[step]!,
        })
      })
    }
  }

  return records
}

// Warm, jargon-light prose. PS7 asks for summaries that "translate technical
// data" into something a parent can actually act on, so no band scores,
// percentiles, or assessment vocabulary here.
const SEED_SUMMARIES: Record<string, string> = {
  s1: 'Nur has had a good few months. His reading is getting steadier — he is recognising more words on sight and needing fewer reminders to sound them out. Spelling dipped over the middle of the term, which is common when a child starts attempting harder words rather than sticking to safe ones, and it has since recovered. Comprehension remains his strongest area: he follows a story well and can tell you what happened and why.',
  s2: 'Elias is making steady progress across the board. He reads accurately and understands what he reads; the piece that lags is fluency, meaning he can get the words right but still reads slowly and effortfully. That gap narrowed towards the end of the term. Writing has come along noticeably — his sentences are longer and better organised than they were in January.',
  s3: 'Sofia is early in her journey and moving in the right direction. Sounding out words is becoming more automatic for her, which is the foundation everything else is built on. Writing dipped mid-term while she worked on forming longer sentences, and it has picked back up. She enjoys being read to and answers questions about the story confidently.',
}

const SEED_RECOMMENDATIONS: Record<string, string> = {
  s1: [
    'Read together for 15 minutes a day and let him choose the book — interest matters more than level.',
    'For spelling, try three words a day rather than a long weekly list.',
    'Ask him to retell the story in his own words after reading; he is strong here, so it builds confidence.',
    'Keep sessions short and stop before he tires.',
  ].join('\n'),
  s2: [
    'Re-read the same short passage a few times across the week — repetition is what builds reading speed.',
    'Try paired reading: you read a line, he reads the next.',
    'Let him listen to an audiobook while following the printed text.',
    'Praise the effort on longer written pieces, not just the spelling accuracy.',
  ].join('\n'),
  s3: [
    'Play rhyming and sound games in the car or at dinner — no worksheet needed.',
    'Use letter tiles or magnets so building words feels like play rather than a test.',
    'Keep writing practice to short bursts, celebrating one good sentence.',
    'Continue reading aloud to her daily; her comprehension is ahead of her decoding.',
  ].join('\n'),
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

class InMemoryDatabase implements Database {
  private readonly parents = new Map<string, Parent>([[PARENT.parentId, PARENT]])
  private readonly students = new Map<string, Student>(STUDENTS.map((s) => [s.studentId, s]))
  private readonly progressRecords: ProgressRecord[] = buildProgressRecords()
  private readonly summaries = new Map<string, Summary>()
  private readonly recommendations = new Map<string, Recommendation>()
  private readonly preferences = new Map<string, NotificationPreference>([
    [
      PARENT.parentId,
      { parentId: PARENT.parentId, enabled: true, frequency: 'Weekly', recipientEmail: PARENT.email },
    ],
  ])

  constructor() {
    // Pre-seed one summary per student so `getLatestSummary` has something to
    // return before any summary has been generated this run.
    const generatedAt = new Date('2026-05-19T09:00:00Z').toISOString()
    for (const student of STUDENTS) {
      const summary: Summary = {
        summaryId: `sum-${student.studentId}`,
        studentId: student.studentId,
        content: SEED_SUMMARIES[student.studentId]!,
        generatedAt,
      }
      this.summaries.set(summary.studentId, summary)
    }
  }

  getParent(parentId: string): Parent | undefined {
    return this.parents.get(parentId)
  }

  // Auth is a separate workstream. Until it lands, `GET /api/me` resolves to
  // the single seeded parent rather than a session lookup.
  getDefaultParent(): Parent {
    return PARENT
  }

  getStudentsForParent(parentId: string): Student[] {
    const parent = this.parents.get(parentId)
    if (!parent) return []
    return parent.studentIds
      .map((id) => this.students.get(id))
      .filter((s): s is Student => s !== undefined)
  }

  getStudent(studentId: string): Student | undefined {
    return this.students.get(studentId)
  }

  getProgressRecords(studentId: string): ProgressRecord[] {
    return this.progressRecords
      .filter((r) => r.studentId === studentId)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  getLatestSummary(studentId: string): Summary | undefined {
    return this.summaries.get(studentId)
  }

  saveSummary(summary: Summary): Summary {
    this.summaries.set(summary.studentId, summary)
    return summary
  }

  getRecommendationForSummary(summaryId: string): Recommendation | undefined {
    return this.recommendations.get(summaryId)
  }

  saveRecommendation(recommendation: Recommendation): Recommendation {
    this.recommendations.set(recommendation.summaryId, recommendation)
    return recommendation
  }

  getPreferences(parentId: string): NotificationPreference | undefined {
    return this.preferences.get(parentId)
  }

  savePreferences(prefs: NotificationPreference): NotificationPreference {
    this.preferences.set(prefs.parentId, prefs)
    return prefs
  }

  getAllPreferences(): NotificationPreference[] {
    return [...this.preferences.values()]
  }
}

export const database: Database = new InMemoryDatabase()

// Exported for the seeded recommendation text; the generator service reads it.
export const seedRecommendationText = SEED_RECOMMENDATIONS
