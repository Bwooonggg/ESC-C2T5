# DAS Platform — System Architecture

**Project:** ESC C2T5 — DAS DIAL (Problem Statements 1, 3, 7)
**Institution:** Singapore University of Technology and Design
**Last updated:** _(update when this changes)_

---

## 1. Overview

The DAS Platform is a single web application for the Dyslexia Association of
Singapore, assembled from three independently developed subsystems plus a shared
frontend. It follows a **microservice architecture**: each subsystem is its own
codebase, its own container, and its own deployable unit, but the user
experiences one coherent product behind a single domain and a single login.

| Subsystem | Problem statement | Responsibility |
|---|---|---|
| **Screening** | DAS 1 — Learning Screening Engine | Digital literacy screening, ML risk prediction, screening reports |
| **Worksheet** | DAS 3 — Adaptive Learning Activity Generator | RAG pipeline, LLM worksheet generation for educational therapists |
| **Insight** | DAS 7 — Parent Insight Dashboard | Progress tracking, AI summaries, recommendations, parent notifications |

Authentication and the database are **not built in-house** — they are provided by
Supabase (see §6, §7).

---

## 2. Repository strategy

We use a **polyrepo** (multi-repo) layout. Each subsystem team owns and deploys
its own repository, and no team can accidentally break another team's code.

| Repo | Contains |
|---|---|
| `ESC-Project-DAS-1` | DAS 1 screening service — backend + ML model + `Dockerfile` |
| `<das3-repo>` | DAS 3 worksheet service — LangGraph/LangChain RAG + `Dockerfile` |
| `<das7-repo>` | DAS 7 insight service — progress/summary API + `Dockerfile` |
| `das-frontend` | Unified React (Vite) app — all three UIs + `Dockerfile` |
| `das-platform` | **Orchestration only** — `docker-compose.yml`, `.env.example`, README |

`das-platform` contains no application code. It is the glue that composes the
other repos into one running system.

### Trade-off we accepted

Polyrepo keeps blast radius small and ownership clear, at the cost of:

- Cross-cutting changes (e.g. changing the screening API response shape) require
  coordinated commits in two or three repos.
- Shared code (JWT verification middleware) is duplicated per service rather than
  imported from one place. **This is accepted** — the middleware is ~40 lines.
- Onboarding requires cloning five repos side by side (see §9).

### Required local layout

Because `docker-compose.yml` builds from sibling directories, **all repos must be
cloned into the same parent folder**:

```
projects/
├── das-platform/          # run docker compose from here
├── ESC-Project-DAS-1/
├── das3-worksheet/
├── das7-insight/
└── das-frontend/
```

If your folder names differ, update the `build:` paths in `docker-compose.yml`.

---

## 3. System diagram

```
                    ┌─────────────────────────────────────┐
                    │            BROWSER                  │
                    │   (React app runs here at runtime)  │
                    └───────┬─────────────────────┬───────┘
                            │                     │
                 app + /api │                     │ login (direct)
                            │                     │
┌───────────────────────────▼──────────────┐      │   ┌──────────────────────┐
│         YOUR DOCKER NETWORK              │      │   │      SUPABASE        │
│                                          │      │   │       (cloud)        │
│   ┌──────────────────────────────────┐   │      └──▶│                      │
│   │           TRAEFIK  :80           │   │          │  ┌────────────────┐  │
│   │      (only exposed container)    │   │          │  │  Supabase Auth │  │
│   └───┬────────┬─────────┬───────┬───┘   │  JWKS    │  │  JWT + JWKS    │  │
│       │        │         │       │       │ ◀────────┼──┤                │  │
│    /  │   /api/│    /api/│  /api/│       │ (public  │  └────────────────┘  │
│       │  screen│   worksh│ insigh│       │   key,   │                      │
│  ┌────▼───┐ ┌──▼───┐ ┌───▼──┐ ┌──▼────┐  │  once)   │  ┌────────────────┐  │
│  │Frontend│ │Screen│ │Worksh│ │Insight│  │          │  │   PostgreSQL   │  │
│  │ static │ │ DAS1 │ │ DAS3 │ │ DAS7  │──┼──────────┼─▶│  schema per    │  │
│  │ files  │ │      │ │      │ │       │  │ SQL/TLS  │  │  service + RLS │  │
│  └────────┘ └──────┘ └──────┘ └───────┘  │          │  └────────────────┘  │
│                                          │          │                      │
└──────────────────────────────────────────┘          └──────────────────────┘
       WE BUILD AND RUN THIS                              SUPABASE RUNS THIS
```

---

## 4. The frontend (two lives)

"The frontend" means two different things, and keeping them separate explains the
whole diagram:

**Its files** — the compiled Vite output (`dist/`: `index.html`, JS, CSS) — are
served by a small nginx inside the `frontend` container, sitting behind Traefik at
`PathPrefix(/)`. nginx here is *only* a static file server; it is **not** the API
gateway (that is Traefik's job).

**Its runtime** is the browser. Once those files are downloaded, the React app
executes on the user's machine. Every arrow leaving "Browser" in the diagram is
this code making a call. This is why login talks *directly* to Supabase Auth —
`supabase-js` runs client-side, not on our servers.

The frontend uses `react-router-dom` so the three subsystems appear as routes
(`/screening`, `/worksheet`, `/insights`) within one application.

### Rule: always call relative paths

```js
fetch('/api/worksheet/generate')          // ✅ works in dev and in containers
fetch('http://localhost:8002/generate')   // ❌ bypasses the gateway, breaks on deploy
```

In local dev without containers, Vite's dev-server proxy forwards `/api/*` to the
backends — playing the same role Traefik plays in the built system, so the same
code works in both.

---

## 5. Traefik (API gateway)

Traefik is the **single front door**. It is the only container that publishes a
port; every other container is unreachable from outside the Docker network.

It routes by URL path:

| Path prefix | Goes to |
|---|---|
| `/api/screening/*` | Screening (DAS 1) |
| `/api/worksheet/*` | Worksheet (DAS 3) |
| `/api/insights/*` | Insight (DAS 7) |
| `/` (catch-all) | Frontend static files |

Traefik prioritises longer rules, so `/api/worksheet` always wins over `/`.

### Why a gateway rather than calling each service directly

- **No CORS.** Everything is same-origin, so no preflight configuration in three
  codebases.
- **One TLS certificate** instead of three (Let's Encrypt, automatic).
- **Smaller attack surface.** Backends have no published ports at all.
- **No hardcoded URLs** in the frontend — only relative paths.
- **Cross-cutting concerns** (rate limiting, logging, headers) configured once.

### Configuration by labels

Traefik mounts the Docker socket read-only and watches containers as they start.
Routes are declared as **labels** in `docker-compose.yml`, not in a separate
config file. Start a container → its route appears; stop it → the route
disappears.

### Note: gateway ≠ service-to-service

Traefik handles **browser → service** traffic only. When DAS 7 needs data from
DAS 1, it calls the other container directly over the Docker network:

```
http://screening:8000/results/123
```

That uses the internal port with **no** `/api/screening` prefix, because prefix
stripping only happens for traffic arriving through Traefik.

---

## 6. Authentication (Supabase + JWT)

### Flow

1. Browser calls Supabase Auth directly → receives a signed **JWT** access token
   (plus refresh token; `supabase-js` handles storage and auto-refresh).
2. Every API request carries `Authorization: Bearer <token>` through Traefik.
3. The receiving service **verifies the token before any other logic runs**.
   Invalid or expired → `401`, and no database query happens.
4. Only after verification does the service read the `sub` claim to identify the
   user and proceed.

The token travels *with* the request, so identity is confirmed at the door —
protected data is never returned before the check.

### Local verification (asymmetric keys)

Supabase signs tokens with a **private key** that never leaves Supabase, and
publishes the matching **public key** via JWKS:

```
https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
```

Each service fetches that public key **once at startup** and caches it. From then
on, verification is a local cryptographic operation — **no network call to
Supabase per request**. The public key can only *verify*, never *forge*, so it is
safe to distribute to all three services. Services re-fetch only when they see a
token signed by an unknown key (rotation).

Every verification checks: signature valid → `exp` not in the past → then trust
the claims.

### Authentication vs authorization

- **Authentication** = "is this a real, unexpired token?" (JWT verification)
- **Authorization** = "is this user allowed to see *these rows*?" (RLS / service
  logic)

A valid token does not by itself grant access to a specific child's records.
Both checks are required.

---

## 7. Data layer

One Supabase-hosted PostgreSQL instance, reached over TLS from each service.

### Ownership rule (important)

> **One database, one schema per service, each service owns its own tables.**
> When a service needs another's data, it asks over the API — it does not query
> the other's tables directly.

So DAS 7 fetches screening history via `GET /api/screening/results/{childId}`,
**not** by joining `screening_results` in SQL.

Why: sharing tables silently welds the services together. The day DAS 1 renames a
column, DAS 7 breaks with no contract to warn anyone — the network complexity of
microservices with the coupling of a monolith ("distributed monolith").

If deadline pressure demands it, an acceptable shortcut is a **read-only view**
that DAS 1 explicitly publishes for DAS 7 — still an intentional contract, not a
hidden reach-in. Document whichever is chosen.

### Connection strings

Supabase offers three; for always-on containers use the **session pooler on port
5432**:

```
postgresql://postgres.<ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres
```

- Direct (`db.<ref>.supabase.co:5432`) — IPv6-only unless the IPv4 add-on is enabled.
- Session pooler (`:5432`) — dedicated connection, IPv4-friendly. **Use this.**
- Transaction pooler (`:6543`) — for serverless/edge; does **not** support
  prepared statements.

Since Feb 2025, port `6543` is transaction mode only and `5432` is session mode —
do not put `6543` in a session-style string.

### Row Level Security

RLS policies filter rows by JWT claims, enforcing access in the database itself.

⚠️ **Connecting with the `service_role` key bypasses RLS entirely.** Our Python
backends use direct SQL, so they must either enforce authorization in service
code or deliberately set the request role so policies still apply. Do not assume
RLS is protecting you when connected as `service_role`.

---

## 8. Docker networking

`docker compose up` creates a **private virtual network** for the project. Every
container joins it and gets an internal IP. Nothing on it is reachable from
outside except Traefik's published `:80`.

**Service names are hostnames.** Docker runs an embedded DNS server that maps each
service name from `docker-compose.yml` to that container's current IP. Code uses
`http://screening:8000`, never a hardcoded IP (IPs change on restart).

### Two meanings of "port"

- **Listening port** — the port the app listens on *inside* the network
  (Uvicorn on `8000`). Container-to-container traffic uses this; needs no config.
- **Published port** — the `ports: "80:80"` syntax, which pokes a hole from the
  host into the network. Only Traefik has one.

Consequence: **`localhost:8000` will not reach a backend.** Everything goes
through `localhost/api/...`. To debug routing, use the Traefik dashboard at
`localhost:8080`.

---

## 9. `docker-compose.yml` (in `das-platform`)

```yaml
services:
  traefik:
    image: traefik:v3.3
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--api.dashboard=true"
    ports:
      - "80:80"
      - "8080:8080"          # dashboard — dev only, remove before deploying
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped

  frontend:
    build: ../das-frontend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=PathPrefix(`/`)"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"
    restart: unless-stopped

  screening:
    build: ../ESC-Project-DAS-1
    env_file: .env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.screening.rule=PathPrefix(`/api/screening`)"
      - "traefik.http.routers.screening.middlewares=screening-strip"
      - "traefik.http.middlewares.screening-strip.stripprefix.prefixes=/api/screening"
      - "traefik.http.services.screening.loadbalancer.server.port=8000"
    restart: unless-stopped

  worksheet:
    build: ../das3-worksheet
    env_file: .env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.worksheet.rule=PathPrefix(`/api/worksheet`)"
      - "traefik.http.routers.worksheet.middlewares=worksheet-strip"
      - "traefik.http.middlewares.worksheet-strip.stripprefix.prefixes=/api/worksheet"
      - "traefik.http.services.worksheet.loadbalancer.server.port=8000"
    restart: unless-stopped

  insight:
    build: ../das7-insight
    env_file: .env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.insight.rule=PathPrefix(`/api/insights`)"
      - "traefik.http.routers.insight.middlewares=insight-strip"
      - "traefik.http.middlewares.insight-strip.stripprefix.prefixes=/api/insights"
      - "traefik.http.services.insight.loadbalancer.server.port=8000"
    restart: unless-stopped
```

**No `postgres` service and no `volumes:`** — the database is Supabase.
**No `networks:`** — Compose creates the default network automatically.

### The three labels that matter

- **`rule`** — the path Traefik matches.
- **`stripprefix`** — removes `/api/worksheet` so FastAPI sees `/generate`.
  Skip this and you get confusing 404s inside a service that looks healthy.
- **`loadbalancer.server.port`** — the port the app listens on inside the
  container.

---

## 10. Dockerfiles

### Backend service (FastAPI)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`--host 0.0.0.0` is **required** — the default `127.0.0.1` only accepts
connections from inside the container, so Traefik could not reach it.

### Frontend (multi-stage: build with Node, serve with nginx)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

`nginx.conf` — the SPA fallback prevents 404s when refreshing on `/dashboard`:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

## 11. Environment variables

### Backends — `das-platform/.env` (gitignored)

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWKS_URL=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres
```

Commit `.env.example` with the same keys and blank values.

### Frontend — `das-frontend/.env.local` (gitignored)

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

The `VITE_` prefix is mandatory, and these values are **baked into the built JS
and publicly visible**. That is fine for the anon key (RLS assumes it is public).
The `service_role` key must **never** appear in the frontend.

### `.gitignore` (every repo)

```gitignore
.env
.env.*
!.env.example
```

Note: `./das-platform/.env` does **not** work — a leading `./` is treated as a
literal path component and matches nothing. Verify with
`git check-ignore -v <path>`.

---

## 12. Getting started

```bash
# 1. Clone all five repos into the SAME parent folder
mkdir projects && cd projects
git clone https://github.com/<org>/das-platform.git
git clone https://github.com/pat26260/ESC-Project-DAS-1.git
git clone https://github.com/<org>/<das3-repo>.git
git clone https://github.com/<org>/<das7-repo>.git
git clone https://github.com/<org>/das-frontend.git

# 2. Fill in secrets
cd das-platform
cp .env.example .env        # then paste the Supabase values

# 3. Run everything
docker compose up --build
```

Verify in order:

| Check | URL | Expect |
|---|---|---|
| Frontend loads | `http://localhost` | The React app |
| Traefik routing | `http://localhost:8080` | All four routers listed |
| Backend reachable | `http://localhost/api/worksheet/health` | 200 from DAS 3 |

If a route 404s, the label is almost always the cause — the dashboard shows
exactly what Traefik registered.

---

## 13. Known gotchas

| Symptom | Cause |
|---|---|
| 404 from a service that looks healthy | Missing `stripprefix` — service receives the full `/api/...` path |
| Traefik can't reach a service | Uvicorn bound to `127.0.0.1` instead of `0.0.0.0` |
| `localhost:8000` refuses connection | Correct — backends publish no ports; use `localhost/api/...` |
| Code change has no effect | Forgot `--build` on `docker compose up` |
| Refresh on `/dashboard` gives 404 | Missing SPA fallback in `nginx.conf` |
| CORS errors | Frontend calling an absolute URL instead of a relative `/api/...` path |
| Can't connect to Supabase before a demo | **Free-tier projects pause after ~1 week idle** — resume in the dashboard beforehand |
| `.env` still shows as untracked | `./`-prefixed gitignore pattern; use `.env` |
| Prepared-statement errors | Using transaction pooler (`:6543`) — switch to `:5432` or disable prepared statements |

---

## 14. Cross-repo coordination

Because the repos are separate, these need explicit process:

1. **API contracts are the interface.** Any change to a service's request or
   response shape must be announced before merging — DAS 7 and the frontend
   depend on DAS 1's shapes.
2. **Keep this document current.** It is the only place the whole system is
   described; if a path or prefix changes, update §9.
3. **Nobody pushes secrets.** Check `.gitignore` in every repo, not just one.
4. **Version compatibility.** There is no single commit representing "the working
   system." Before a demo, tag a known-good commit in each repo and record the
   five hashes here.

### Known-good combination

| Repo | Commit | Date |
|---|---|---|
| das-platform | | |
| ESC-Project-DAS-1 | | |
| das3-worksheet | | |
| das7-insight | | |
| das-frontend | | |

---

## 15. Deployment notes (future)

- Add a Let's Encrypt certificate resolver to Traefik's `command` and two labels
  per router → automatic HTTPS. Roughly a ten-line change.
- Remove the `8080:8080` dashboard port mapping.
- Set `restart: always`.
- Rotate any Supabase keys that were ever committed to git history.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| **Microservice** | Independently deployable service owning one domain |
| **Distributed monolith** | Anti-pattern: separate services that share tables, so they must change together |
| **API gateway** | Single entry point routing external traffic to internal services (Traefik) |
| **JWT** | Signed token carrying identity claims; `header.payload.signature` |
| **JWKS** | Endpoint publishing the public keys used to verify JWTs |
| **RLS** | Row Level Security — Postgres policies filtering rows by user |
| **SSE** | Server-Sent Events — streaming used by the DAS 3 chat UI |
| **Polyrepo** | One repository per service (our choice) |
| **Monorepo** | All services in one repository (considered, not adopted) |
