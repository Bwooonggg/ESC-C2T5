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
- DAS3 has a LangGraph backend and standalone frontend, but does not verify
  Supabase JWTs.
- DAS7 verifies Supabase JWTs and maps `sub` to
  `insight.parents.auth_user_id`.
- The root frontend has one Supabase client. Separate worksheet and insight
  sessions are not implemented yet.
- Brevo remains the DAS7 production email provider.
- Docker and Traefik are no longer part of the target deployment.

## Shared completion conditions

Integration is complete when:

- The root frontend owns all three user-facing sections.
- DAS1 remains public.
- DAS3 accepts teachers and rejects parents.
- DAS7 accepts parents and rejects teachers.
- Worksheet and insight sessions can exist and sign out independently.
- Each frontend section calls only its own backend.
- The full system runs without Docker or Traefik.
- The production proxy or CORS choice has been tested in the chosen host.
- `README.md`, `API_CONTRACTS.md`, and `docs/ARCHITECTURE.md` describe the code as
  implemented.

## Cleanup

After the completion conditions pass:

1. Move any operational information that still matters into the root README or
   permanent architecture document.
2. Remove obsolete standalone frontend references.
3. Decide whether to delete the old Docker and Traefik files.
4. Delete `docs/integration/`.
