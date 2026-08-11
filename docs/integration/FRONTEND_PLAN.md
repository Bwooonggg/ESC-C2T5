# Frontend integration plan

## Goal

Turn the root `frontend/` package into the single browser application for DAS1,
DAS3, and DAS7. The application will have these routes:

| Route | Access | Backend |
| --- | --- | --- |
| `/` | Public | None |
| `/screening/*` | Public | DAS1 |
| `/worksheet/login` | Public login page | Supabase Auth |
| `/worksheet/*` | Teachers | DAS3 |
| `/insights/login` | Public login page | Supabase Auth |
| `/insights/*` | Parents | DAS7 |

The frontend handles Supabase login, session refresh, and logout. The backends
remain responsible for authorization.

## Rules to keep throughout the work

- Keep one root React application. Do not run the three old frontends inside
  iframes or as separate builds.
- Preserve each service's API format instead of creating a frontend-wide response
  envelope.
- Read access tokens at request time. Do not capture a JWT in a module-level API
  client because Supabase refreshes access tokens.
- Use Supabase only for authentication. Application data must go through a backend.
- Do not add public sign-up. Accounts are created or invited by an administrator.
- Do not place service-role, LLM, or Brevo credentials in `frontend/.env`.

## Phase 1: create the application shell

This phase is sequential because every feature section needs the final route tree
and shared layout.

- [ ] Replace the current DAS7-only routes in `frontend/src/App.tsx` with the route
  structure listed above.
- [ ] Add a homepage with links to Screening, Worksheet, and Insights.
- [ ] Add a shared page layout and navigation that can return to the homepage.
- [ ] Keep service-specific state below its route. Navigating between services
  should not reuse another service's selected student, form, or request state.
- [ ] Remove `/signup` from the public route tree.
- [ ] Move the current DAS7 pages under `/insights/*` without changing backend
  behavior yet.

Completion check:

- Every planned URL renders the correct placeholder or existing DAS7 page.
- Refreshing a nested URL does not send the user to the wrong section.
- Unknown routes lead to a useful not-found page or the homepage.

## Phase 2: split authentication and API infrastructure

After the route tree exists, the auth and API work can be done in parallel by two
contributors. They touch different modules but must agree on the service names
`screening`, `worksheet`, and `insights`.

### Auth lane

- [ ] Replace `frontend/src/lib/supabaseClient.ts` with two clients that share
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Give the worksheet client a stable storage key such as
  `dial-worksheet-auth`.
- [ ] Give the insights client a stable storage key such as
  `dial-insights-auth`.
- [ ] Keep `persistSession` and automatic token refresh enabled.
- [ ] Split the current auth helpers so each helper requires an explicit service
  or uses a service-specific module.
- [ ] Implement `/worksheet/login` with the worksheet client.
- [ ] Rebase the current login page onto `/insights/login` with the insights
  client.
- [ ] Use `signOut({ scope: "local" })` on the matching client.
- [ ] Add separate route guards. A worksheet guard must never read the insights
  session, and the reverse must also hold.
- [ ] Keep both auth-state subscriptions independent and unsubscribe them when
  their providers or guards unmount.

### API lane

- [ ] Add these variables to `frontend/.env.example`:

  ```dotenv
  VITE_DAS1_API_URL=/api/screening
  VITE_DAS3_API_URL=/api/worksheet
  VITE_DAS7_API_URL=/api/insights
  ```

- [ ] Replace the fixed prefix map with an environment-backed base URL per
  service, using the relative values above as local defaults.
- [ ] Create a DAS1 API client with no `Authorization` header.
- [ ] Rename the existing generic DAS7 client so its ownership is obvious.
- [ ] Make the DAS7 client read the current insights access token immediately
  before each protected request.
- [ ] Create a worksheet LangGraph client factory that reads the current worksheet
  token before constructing or invoking the SDK client.
- [ ] Send `Authorization: Bearer <token>` on all protected worksheet and insight
  requests.
- [ ] Keep the existing Vite proxy rules for local development.

Completion check:

- Unit tests prove that each API client uses its own base URL.
- DAS1 requests have no bearer token.
- DAS3 requests use only the worksheet token.
- DAS7 requests use only the insights token.

## Phase 3: integrate the three feature sections

The three lanes in this phase can run in parallel. Assign each lane clear ownership
of its route folder and API module to avoid merge conflicts.

### Screening lane

Source: `DAS_1/demo_app/src/`

- [ ] Move or adapt the screening page, views, controller hook, shared types, and
  accessibility controls into the root frontend.
- [ ] Route all screening traffic through the DAS1 API client.
- [ ] Preserve the non-diagnostic wording and current screening flow.
- [ ] Remove imports that reach back into the standalone frontend.
- [ ] Port the DAS1 frontend tests that still describe the centralized version.

### Worksheet lane

Source: `DAS_3/frontend/src/`

- [ ] Move or adapt the educational panel, accessibility modal, worksheet preview,
  LangGraph utilities, and their styles into `/worksheet/*`.
- [ ] Add the required DAS3 frontend dependencies to the root
  `frontend/package.json` and lockfile. Use the root React version.
- [ ] Route all LangGraph calls through the authenticated worksheet client
  factory.
- [ ] Preserve thread, run, interrupt, clarification, and streaming behavior.
- [ ] Port the useful DAS3 frontend tests into the root frontend test setup.
- [ ] Confirm that a refreshed Supabase token is used for later LangGraph calls.

### Insights lane

Source: the current root `frontend/src/`

- [ ] Move the existing pages under `/insights/*`.
- [ ] Update links and redirects from `/login` to `/insights/login`.
- [ ] Make every insights request use the insights auth helper.
- [ ] Keep progress, recommendations, and email preference behavior unchanged.
- [ ] Remove the public sign-up page and form if no other code uses them.

Completion check:

- Each section works against its backend without importing another section's API
  or auth module.
- Navigating between sections does not clear either auth session.
- The root frontend builds with one React version and one lockfile.

## Phase 4: connect role checks and error handling

This phase follows the feature lanes because it depends on their API clients. It
also depends on the backend identity checks described in `BACKEND_PLAN.md`.

- [ ] After worksheet login, make a small authenticated LangGraph thread search to
  confirm that the account has a teacher profile. Do not add a separate DAS3
  identity endpoint.
- [ ] After insights login, call `/api/insights/me` to confirm that the account has
  a parent profile.
- [ ] On `401`, keep the other service's session and send the user to the matching
  login page.
- [ ] On `403`, show an access-denied page with an option to sign out of that
  service and use another account.
- [ ] On `404`, show a generic not-found message. Do not state whether the record
  belongs to someone else.
- [ ] Use generic login failure text that does not reveal whether an email address
  exists.
- [ ] Prevent an authenticated parent session from unlocking worksheet routes and
  a teacher session from unlocking insight routes.

## Phase 5: test and hand off

Unit and section-level tests can run in parallel. Run the cross-section tests after
all three sections have been merged.

### Tests that can run in parallel

- [ ] Screening component and API tests.
- [ ] Worksheet component, LangGraph utility, and API tests.
- [ ] Insights component and API tests.
- [ ] Worksheet auth-client tests.
- [ ] Insights auth-client tests.

### Tests that run after the parallel suites

- [ ] A teacher and parent can be logged in at the same time.
- [ ] Worksheet logout leaves the insights session active.
- [ ] Insights logout leaves the worksheet session active.
- [ ] A `401` from one backend does not clear the other session.
- [ ] Wrong-group access produces the access-denied flow.
- [ ] Every route works through the Vite proxy with the three local backends.
- [ ] The worksheet client works with the DAS3 container exposed on port `2024`.
- [ ] `npm run frontend:test` passes.
- [ ] `npm run frontend:build` passes.

## Frontend definition of done

- One root frontend contains all three sections.
- The homepage and service routes match the architecture document.
- DAS1 is public.
- DAS3 and DAS7 have separate login pages and simultaneous sessions.
- Each service calls only its own backend with the correct token behavior.
- There is no public sign-up path.
- The old standalone frontends are no longer required for normal use.
- Tests and the production build pass.

## References

- [Supabase JavaScript client initialization](https://supabase.com/docs/reference/javascript/initializing)
- [Supabase sign-out scopes](https://supabase.com/docs/reference/javascript/auth-signout)
- [LangGraph custom authentication client headers](https://docs.langchain.com/langsmith/custom-auth)
