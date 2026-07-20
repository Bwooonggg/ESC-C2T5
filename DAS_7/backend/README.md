# DAS 7 Backend

This directory contains the TypeScript/Express backend scaffold described in
[`docs/backend-architecture.md`](docs/backend-architecture.md).

## Development

```powershell
npm install
npm run dev
```

The API listens on `http://localhost:4000` by default. The frontend's Vite
configuration already proxies `/api` to this port.

Useful checks:

```powershell
npm run typecheck
npm run build
```

## Current scaffold behavior

- `GET /api/health` returns a liveness response.
- `GET /api/health/ready` reports that database readiness is not wired yet.
- Existing frontend and future ingestion routes are registered, but business
  handlers currently return a JSON `501 Not implemented` envelope.
- MySQL, authentication, generator services, email delivery, and worker job
  processing are intentionally reserved for their respective implementation
  slices.
