import type { Request, Response } from 'express'
import * as generatorServiceAdapter from '../adapters/generatorServiceAdapter.js'
import * as trackProgressModel from '../models/trackProgressModel.js'
import { database } from '../repositories/database.js'
import { fail, ok } from '../utils/envelope.js'

// `TrackProgressController` from the Track Child's Progress sequence diagram.

// GET /api/students/:studentId/track-progress
//
// Per the diagram, Get Summary is an <<include>> of Track Child's Progress:
// the summary is always generated as part of tracking, never on a separate
// parent action. So progress and summary return together, from one call.
//
// `?fail=1` forces the progressUnavailable branch on demand, so the frontend's
// error state can be exercised without stopping the server.
export async function trackProgress(req: Request, res: Response): Promise<void> {
  const { studentId } = req.params
  const student = database.getStudent(studentId!)

  if (!student) {
    fail(res, 'progressUnavailable', 404)
    return
  }

  const progress = trackProgressModel.getProgress(student.studentId)

  if (req.query.fail === '1' || progress.length === 0) {
    fail(res, 'progressUnavailable', 503)
    return
  }

  const summary = await generatorServiceAdapter.generateSummary(progress)
  database.saveSummary(summary)

  ok(res, { progress, summary })
}

// GET /api/students/:studentId/summary
//
// PLAN DELTA — not in the PM2 sequence diagram, where the summary arrives
// bundled with track-progress via <<include>>. Added because the README lists
// "Get Summary" as a use case in its own right and the frontend's summaryApi
// calls this path directly. Agree with Vincent before this hardens.
export async function getSummary(req: Request, res: Response): Promise<void> {
  const { studentId } = req.params
  const student = database.getStudent(studentId!)

  if (!student) {
    fail(res, 'progressUnavailable', 404)
    return
  }

  const progress = trackProgressModel.getProgress(student.studentId)
  if (progress.length === 0) {
    fail(res, 'progressUnavailable', 503)
    return
  }

  const summary = await generatorServiceAdapter.generateSummary(progress)
  database.saveSummary(summary)

  ok(res, summary)
}

// POST /api/students/:studentId/recommendations
//
// Per the diagram this is <<extend>> / an `opt` block: parent-initiated, on
// demand, and only meaningful once a summary exists. Hence POST on its own
// route rather than a field on track-progress.
export async function requestRecommendations(req: Request, res: Response): Promise<void> {
  const { studentId } = req.params
  const student = database.getStudent(studentId!)

  if (!student) {
    fail(res, 'No such student.', 404)
    return
  }

  const summary = trackProgressModel.getLatestSummary(student.studentId)
  if (!summary) {
    fail(res, 'No summary is available for this student yet.', 409)
    return
  }

  const recommendation = await generatorServiceAdapter.generateRecommendation(summary)
  database.saveRecommendation(recommendation)

  ok(res, recommendation)
}
