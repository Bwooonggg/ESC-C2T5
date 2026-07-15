import type { Request, Response } from 'express'
import { database } from '../repositories/database.js'
import { ok } from '../utils/envelope.js'

// `ParentController` — auth placeholder.
//
// Secure authentication is a separate workstream (Mahek, Jia Zhi). This route
// stands in for "the logged-in parent" so the frontend has a real identity to
// fetch. When auth middleware arrives it should populate the parent from the
// session; the route shape does not need to change.

// GET /api/me
export function getCurrentParent(_req: Request, res: Response): void {
  const parent = database.getDefaultParent()
  const students = database.getStudentsForParent(parent.parentId)
  ok(res, { parent, students })
}
