import express from 'express';
import type { Deps } from './deps.js';
import { createAuthenticate } from './http/auth.js';
import { errorHandler, notFoundHandler } from './http/error-handler.js';
import { healthRoutes } from './http/routes/health.routes.js';
import { meRoutes } from './http/routes/me.routes.js';
import { preferencesRoutes } from './http/routes/preferences.routes.js';
import { studentsRoutes } from './http/routes/students.routes.js';

/** Builds the Express app from an already-assembled dependency graph. */
export function createApp(deps: Deps): express.Express {
    const app = express();

    app.use(express.json());

    // Public: no authentication below this point yet.
    app.use('/api/health', healthRoutes());

    // Everything past here requires an authenticated parent.
    app.use(createAuthenticate(deps));
    app.use('/api/me', meRoutes(deps));
    app.use('/api/students', studentsRoutes(deps));
    app.use('/api/parents', preferencesRoutes(deps));

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
