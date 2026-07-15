import * as notificationController from '../controllers/notificationController.js'
import { database } from '../repositories/database.js'
import type { NotificationFrequency } from '../types/domain.js'

// The `Clock` actor from the Notify Parent sequence diagram.
//
// The diagram starts this flow at Clock.timerExpired() — not at a parent
// action. That is why Notify Parent has no REST endpoint: this setInterval is
// the whole trigger.

const TICK_MS = 15_000

// Real cadences are weeks and months, which no demo can wait for. Time is
// compressed so the Clock is observable while `npm run dev` is running; the
// ordering (Weekly fires most often) is preserved. Swap this map for real
// durations when a real scheduler replaces it.
const DEMO_INTERVAL_MS: Record<NotificationFrequency, number> = {
  Weekly: 30_000,
  Fortnightly: 60_000,
  Monthly: 120_000,
}

const lastNotifiedAt = new Map<string, number>()

async function tick(): Promise<void> {
  const now = Date.now()

  for (const prefs of database.getAllPreferences()) {
    if (!prefs.enabled) continue

    const last = lastNotifiedAt.get(prefs.parentId) ?? 0
    if (now - last < DEMO_INTERVAL_MS[prefs.frequency]) continue

    const students = database.getStudentsForParent(prefs.parentId)
    if (students.length === 0) continue

    lastNotifiedAt.set(prefs.parentId, now)
    console.log(
      `[Clock] timerExpired parent=${prefs.parentId} frequency=${prefs.frequency} students=${students.length}`,
    )

    for (const student of students) {
      // Sequential rather than Promise.all: this mirrors the diagram's one
      // notification at a time, and keeps the demo log readable.
      await notificationController.notifyParent(student, prefs.recipientEmail)
    }
  }
}

export function startClock(): NodeJS.Timeout {
  console.log(`[Clock] started — ticking every ${TICK_MS / 1000}s`)

  const timer = setInterval(() => {
    void tick().catch((error: unknown) => {
      console.error('[Clock] tick failed:', error)
    })
  }, TICK_MS)

  // Do not hold the process open on this timer alone.
  timer.unref()
  return timer
}
