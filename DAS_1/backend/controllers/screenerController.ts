import type { NextFunction, Request, Response } from 'express'
import {
  appendMessage,
  assertNotCompleted,
  attachContact,
  attachReport,
  DomainError,
  isScreenerType,
  recordResponse,
  setNotes,
  validateContact,
} from '../models/screeningSession.ts'
import * as sessions from '../models/sessionRepository.ts'
import * as claude from '../services/claudeService.ts'
import { insertSupa, moveSessionFile } from '../models/table.ts'

/**
 * Controller: turn an HTTP request into Model and Service calls, then hand the
 * updated session back as JSON. No prompts, no persistence, no domain rules
 * live here — the handlers only orchestrate.
 *
 * Express 5 forwards a rejected promise to the error handler, so these throw
 * DomainErrors freely instead of writing error responses inline.
 */

/** Handlers under /sessions/:id. Express types a bare param as string|string[]. */
type SessionRequest = Request<{ id: string }>

export async function createSession(req: Request, res: Response): Promise<void> {
  const { screenerType } = req.body as { screenerType?: unknown }

  if (!isScreenerType(screenerType)) {
    throw new DomainError('screenerType must be either "adult" or "child".')
  }

  res.status(201).json(await sessions.create(screenerType))
}

export async function getSession(req: SessionRequest, res: Response): Promise<void> {
  res.json(await sessions.requireById(req.params.id))
}

/** The user sent a chat message; Claude either asks again or finishes. */
export async function postMessage(req: SessionRequest, res: Response): Promise<void> {
  const { message, notes } = req.body as { message?: unknown; notes?: unknown }

  if (typeof message !== 'string') {
    throw new DomainError('message must be a string.')
  }

  let session = await sessions.requireById(req.params.id)
  if (typeof notes === 'string') {
    session = setNotes(session, notes)
  }
  session = appendMessage(session, 'user', message)

  const decision = await claude.decideNextStep(session)
  session =
    decision.status === 'complete'
      ? attachReport(session, decision.report)
      : appendMessage(session, 'assistant', decision.question)

  res.json(await sessions.save(session))
}

/** The user answered one of the fixed yes/no checklist questions. */
export async function recordAnswer(req: SessionRequest, res: Response): Promise<void> {
  const { question, answer } = req.body as { question?: unknown; answer?: unknown }

  if (typeof question !== 'string' || typeof answer !== 'string') {
    throw new DomainError('question and answer must both be strings.')
  }

  const session = await sessions.requireById(req.params.id)
  res.json(await sessions.save(recordResponse(session, question, answer)))
}

/** The user chose to finish early; write the report from what we have. */
export async function finishScreener(req: SessionRequest, res: Response): Promise<void> {
  const { notes } = req.body as { notes?: unknown }

  let session = await sessions.requireById(req.params.id)
  // attachReport enforces this too, but only after the report exists; checking
  // here keeps a finished session from costing another Claude call.
  assertNotCompleted(session)

  if (typeof notes === 'string') {
    session = setNotes(session, notes)
  }

  const report = await claude.generateReport(session)
  res.json(await sessions.save(attachReport(session, report)))
}

export async function submitContact(req: SessionRequest, res: Response): Promise<void> {
  const contact = validateContact(req.body)
  const session = await sessions.requireById(req.params.id)
  const completeSession = await sessions.save(attachContact(session, contact))
  await insertSupa(completeSession)
  await moveSessionFile()
  res.json(completeSession)
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = error instanceof DomainError ? error.status : 500
  const message = error instanceof Error ? error.message : 'Server error'

  if (status >= 500) {
    console.error(error)
  }

  res.status(status).json({ error: message })
}
