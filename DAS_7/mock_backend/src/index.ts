import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { das7Routes } from './routes/das7Routes.js'
import { startClock } from './utils/clock.js'
import { fail } from './utils/envelope.js'

const PORT = Number(process.env.PORT ?? 4000)

const app = express()

// The Vite dev server proxies /api to this port, so browser requests remain
// on the same origin during local development.
app.use(express.json())

app.use('/api', das7Routes)

// Unknown route -> 404 in the same envelope as everything else, so a typo'd
// path fails the same way a real error does rather than returning Express's
// HTML page into a client expecting JSON.
app.use((_req: Request, res: Response) => {
  fail(res, 'Not found.', 404)
})

// Four parameters, or Express does not recognise this as an error handler.
// `_next` is unused by design.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] unhandled error:', error)
  fail(res, 'Something went wrong on the server.', 500)
})

app.listen(PORT, () => {
  console.log(`[server] DAS 7 mock backend listening on http://localhost:${PORT}`)
  console.log(`[server] health: http://localhost:${PORT}/api/health`)
  startClock()
})
