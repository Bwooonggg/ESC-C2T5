# D.I.A.L

D.I.A.L is a student project for the Dyslexia Association of Singapore (DAS). This
repository contains three parts of the wider D.I.A.L system:

| Service | User | Purpose | Access |
| --- | --- | --- | --- |
| DAS1 Screening | Public | Runs a non-diagnostic screening flow | No login |
| DAS3 Worksheet | Teachers | Generates teaching worksheets from DAS material | Teacher login |
| DAS7 Insights | Parents | Shows student progress, summaries, recommendations, and email preferences | Parent login |

The application has one React frontend and three separately run backends. The
backends stay independent. A page in the frontend calls only the backend that owns
that page.

## Current iteration

The root `frontend/` is now the centralized user interface for all three services.
Each service keeps its own backend and API boundary, while navigation, branding,
accessibility controls, authentication handling, and responsive layouts are shared.

The current routes are:

| Route | Service |
| --- | --- |
| `/` | Homepage with links to the three services |
| `/screening/*` | DAS1 public screening pages |
| `/worksheet/login` | DAS3 teacher login |
| `/worksheet/*` | DAS3 teacher pages |
| `/insights/login` | DAS7 parent login |
| `/insights/*` | DAS7 parent pages |

Current functionality includes:

- DAS1 adult and child screening flows with internally scrollable questionnaires.
- DAS3 authenticated worksheet generation with a fixed prompt area and independently
  scrollable conversation and document panels.
- DAS7 parent progress, summaries, recommendations, notification preferences, and an
  authenticated **Send update now** action.
- Local browser preview stubs for all three services when `VITE_USE_STUBS=true`.

`DAS_7/frontend/` is the older standalone DAS7 interface. It remains in the repository
as a reference but is not started by the root development scripts and does not affect
the centralized frontend.

The permanent design is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Historical
implementation plans remain under `docs/integration/` until that temporary folder is
cleaned up; they should not be treated as the current runtime guide.

## Repository layout

```text
ESC-C2T5/
|-- frontend/               Centralized React frontend for DAS1, DAS3, and DAS7
|-- DAS_1/                  Public screening backend and legacy service files
|-- DAS_3/                  Authenticated LangGraph worksheet backend
|-- DAS_7/backend/          Parent insights API and Brevo email scheduler
|-- DAS_7/frontend/         Legacy standalone DAS7 frontend (not started)
|-- docs/                   System architecture and temporary integration notes
|-- Files/                  Project briefs and reference material
|-- API_CONTRACTS.md        Browser-facing API and error conventions
`-- README.md
```

Each package owns its dependencies and lockfile. There is no plan to merge the
three backends.

## Architecture summary

DAS1 is public. DAS3 and DAS7 share one Supabase Auth project, but use different
profile tables and independent browser sessions:

- A teacher account belongs only to DAS3.
- A parent account belongs only to DAS7.
- Accounts are created or invited by an administrator.
- The worksheet and insights sessions use different browser storage keys, so a
  teacher and a parent can be logged in at the same time on one browser.
- Each protected request carries the JWT for that service in the `Authorization`
  header.
- DAS3 checks for a teacher profile. DAS7 checks for a parent profile.
- The frontend uses Supabase for authentication only. Application data goes
  through the relevant backend.

Logging out of Worksheet must not log the user out of Insights, and the reverse is
also true. Supabase service-role credentials stay in backend environment files.
Only the Supabase URL and publishable key may be sent to the browser.

DAS7 keeps Brevo as its production email provider. The fake provider remains
available for local development and tests.

## Local development

### Prerequisites

- Node.js 22 or newer and npm
- Docker Desktop for the persistent DAS3 stack
- Python 3.12 when running DAS3 tests or tooling directly on the host
- A Supabase project for DAS3 and DAS7 authentication and DAS7 data
- Provider credentials required by the service you are running

Never commit a real `.env` file. Copy the relevant `.env.example` and add secrets
only to the copied environment file.

Create the four runtime environment files before starting the complete stack:

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item DAS_1/backend/.env.example DAS_1/backend/.env
Copy-Item DAS_3/.env.example DAS_3/.env
Copy-Item DAS_7/backend/.env.example DAS_7/backend/.env
```

Install the host-side packages once:

```powershell
npm install --prefix frontend
npm install --prefix DAS_1/backend
npm install --prefix DAS_7/backend
```

### Start everything

After installing each package's dependencies and creating the four environment
files, start the complete local backend/frontend stack from the repository root:

```powershell
.\scripts\start-dev.ps1
```

The script waits for all four ports and writes service output under `.dev/logs`.
Stop only the processes it started, while preserving Docker volumes, with:

```powershell
.\scripts\stop-dev.ps1
```

The services are then available at:

| Service | Local address |
| --- | --- |
| Centralized frontend | `http://localhost:5173` |
| DAS1 backend | `http://localhost:4173` |
| DAS3 LangGraph API | `http://localhost:2024` |
| DAS7 backend | `http://localhost:4000` |

### Frontend preview stubs

For UI-only work, set `VITE_USE_STUBS=true` in `frontend/.env.local` and run only
the centralized frontend:

```powershell
npm run dev --prefix frontend
```

On `localhost`, preview mode bypasses protected routes and supplies in-browser data
for screening, worksheets, parent insights, and email actions. No login password is
needed; open `/screening`, `/worksheet`, or `/insights` directly. Preview sends are
simulated and do **not** exercise Supabase, the service backends, or real email delivery.

Set `VITE_USE_STUBS=false` (or remove the `.env.local` override) and restart Vite when
testing authentication, backend integration, persistence, or Brevo delivery. Stub mode
is deliberately restricted to `localhost` and `127.0.0.1`.

### Centralized frontend

```powershell
npm install --prefix frontend
npm run dev --prefix frontend
```

The frontend runs at `http://localhost:5173`. Its Vite development server proxies:

- `/api/screening/*` to DAS1 at `http://127.0.0.1:4173`
- `/api/worksheet/*` to DAS3 at `http://localhost:2024`
- `/api/insights/*` to DAS7 at `http://localhost:4000`

These are same-origin browser requests, so the backends do not need CORS during
local development.

### DAS1 backend

```powershell
npm install --prefix DAS_1/backend
npm run dev --prefix DAS_1/backend
```

The backend defaults to port `4173`. Check `DAS_1/backend/config.ts` for its current
environment variables. DAS1 does not require a user login.

### DAS3 backend

From `DAS_3/`, copy `.env.example` to `.env`, fill in the backend credentials,
then start the persistent backend stack:

```powershell
docker compose up --build
```

Compose runs LangGraph, PostgreSQL, and Redis and publishes LangGraph on host port
`2024`. DAS3 verifies Supabase JWTs and requires a matching teacher profile.

### DAS7 backend

```powershell
npm install --prefix DAS_7/backend
npm run dev --prefix DAS_7/backend
```

Copy `DAS_7/backend/.env.example` to `DAS_7/backend/.env` first. The backend defaults
to port `4000`. Use `EMAIL_PROVIDER=brevo` with a valid `BREVO_API_KEY` and verified
`EMAIL_FROM` address when real email delivery is required. Use the fake provider
for local work and tests. Scheduled emails use the parent's saved frequency; the
authenticated `POST /parents/:parentId/notifications` endpoint sends the same combined
progress update immediately. Manual sending requires an enabled saved preference and
available student summary data.

## Tests

Run each package's tests from the repository root:

```powershell
npm test --prefix DAS_1
python -m pytest DAS_3/tests
npm test --prefix DAS_3/frontend
npm run frontend:test
npm test --prefix DAS_7/backend
```

Some DAS3 integration tests load the committed Milvus seed and may load model
weights. DAS7 integration tests require a deliberately configured test Supabase
project and skip themselves when the required variables are absent.

## API conventions

The frontend uses one API client per service:

- `/api/screening` for DAS1
- `/api/worksheet` for DAS3
- `/api/insights` for DAS7

The response bodies remain service specific. DAS3 uses the LangGraph thread and
run protocol, while DAS1 and DAS7 use their existing JSON formats. Shared rules
cover routing, JWT transport, status codes, and errors. See
[API_CONTRACTS.md](API_CONTRACTS.md).

The DAS7 email settings page saves preferences through `/api/insights/parents/:parentId/preferences`
and sends an immediate update through `/api/insights/parents/:parentId/notifications`.
Both operations require the parent's Insights access token.

## Runtime scope

Production hosting is out of scope. The target local setup uses Docker only for
the DAS3 LangGraph, PostgreSQL, and Redis stack. The centralized frontend, DAS1,
and DAS7 run directly on the host. Traefik is not used.

The DAS3 Compose file is backend-only; its PostgreSQL, Redis, and model-cache
volumes preserve local service data across container restarts.

## Data handling

- DAS1 screening results are not clinical diagnoses and must not be presented as
  such.
- Do not store full names or NRIC values in DAS1 screening records.
- Do not expose Supabase service-role keys, LLM keys, or Brevo keys to frontend
  code.
- Return the same `404 Not Found` response when a protected record is absent or
  belongs to another user. This avoids revealing whether the record exists.

## Team

C2T5: Brian Wong, Toh Shijie, Patrick Liu, Michael Soh, Le Bin, Vincent Alexander,
Mahek Zaveri, and Jia Zhi.
