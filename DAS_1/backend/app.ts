import express from 'express'
import { errorHandler } from './controllers/screenerController.ts'
import screenerRoutes from './routes/screenerRoutes.ts'

/**
 * Builds the Express app without binding a port, so tests (Supertest, or a
 * cross-package client test) can exercise real routing and middleware without
 * a real listening server.
 */
export function createApp() {
  const app = express()

  app.use(express.json())

  // The gateway owns /api/screening and strips it before forwarding.
  app.use('/', screenerRoutes)

  // Registered last so it catches errors thrown by any handler above it.
  app.use(errorHandler)

  return app
}
