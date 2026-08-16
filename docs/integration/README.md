# Integration plans

This folder contains the temporary plans for reaching the target architecture in
`../ARCHITECTURE.md`.

- [Frontend plan](FRONTEND_PLAN.md)
- [Backend plan](BACKEND_PLAN.md)

Delete this folder after both plans are complete and the permanent documentation
matches the implementation.

## Current state

- The root `frontend/` contains the DAS7 parent interface and sends a Supabase JWT
  to DAS7.
- The root Vite configuration proxies `/api/screening`, `/api/worksheet`, and
  `/api/insights` to the three local backends.
- DAS1 is public and has a standalone frontend.
- DAS3 has a LangGraph backend and standalone frontend, authenticates Supabase JWTs,
  authorizes teacher profiles, and rejects parents.
- DAS7 verifies Supabase JWTs and maps `sub` to
  `insight.parents.auth_user_id`.
- The root frontend has one Supabase client. The independent worksheet and insight
  sessions and UI described in `FRONTEND_PLAN.md` are not implemented yet.
- Brevo remains the DAS7 production email provider.
- Docker is retained only for the local DAS3 backend, PostgreSQL, and Redis stack.
  Traefik is not used.

## Shared completion conditions

Integration is complete when:

- The root frontend owns all three user-facing sections.
- DAS1 remains public.
- DAS3 accepts teachers and rejects parents.
- DAS7 accepts parents and rejects teachers.
- Worksheet and insight sessions can exist and sign out independently.
- Each frontend section calls only its own backend.
- DAS1 and DAS7 run directly on the host, while only DAS3 uses Docker Compose.
- The root Vite proxy connects the local frontend to all three backends.
- `README.md`, `API_CONTRACTS.md`, and `docs/ARCHITECTURE.md` describe the code as
  implemented.

## Cleanup

After the completion conditions pass:

1. Move any operational information that still matters into the root README or
   permanent architecture document.
2. Remove obsolete standalone frontend references.
3. Remove unused frontend and Traefik configuration from the DAS3 Compose setup.
4. Delete `docs/integration/`.
