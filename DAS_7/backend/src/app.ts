import express from 'express';
import type { Deps } from './deps.js';
import { createAuthenticate } from './http/auth.js';
import { errorHandler, notFoundHandler } from './http/error-handler.js';
import { healthRoutes } from './http/routes/health.routes.js';
import { meRoutes } from './http/routes/me.routes.js';
import { preferencesRoutes } from './http/routes/preferences.routes.js';
import { studentsRoutes } from './http/routes/students.routes.js';

/**
 * Builds the Express app from an already-assembled dependency graph.
 *
 * Routes mount at the **root**, not under `/api`. The root Vite dev server is the
 * sole browser-facing proxy: it strips `/api/insights` and forwards to this host
 * process on port 4000.
 */
export function createApp(deps: Deps): express.Express {
    const app = express();

    app.use(express.json());

    // Public: no authentication below this point yet.
    app.use('/health', healthRoutes());

    // Everything past here requires an authenticated parent.
    app.use(createAuthenticate(deps));
    app.use('/me', meRoutes(deps));
    app.use('/students', studentsRoutes(deps));
    app.use('/parents', preferencesRoutes(deps));

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
