# D.I.A.L shared frontend

The shared React/Vite application currently implements the DAS 7 Parent Insight
Dashboard. DAS 1 and DAS 3 have stable API prefixes reserved for future screens.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase
   project's Connect dialog. Never use the service-role key here.
3. Run `npm install` and `npm run dev`.
4. Run the DAS 7 backend on port 4000.

The app calls `/api/insights/*`. Vite strips that prefix and forwards to DAS 7,
just as the production gateway does. Every protected request sends the active
Supabase access token as `Authorization: Bearer <token>`.

The local proxy also reserves `/api/screening` for DAS 1 on port 4173 and
`/api/worksheet` for DAS 3 on port 2024. No DAS 1 or DAS 3 screens are wired into
this application yet.

## Commands

- `npm run dev` — start Vite.
- `npm run build` — type-check and build.
- `npm test` — run Jest tests.
