# Backend integration plan

## Goal

Keep DAS1, DAS3, and DAS7 as independent backends while giving the centralized
frontend consistent routing and authorization behavior.

- DAS1 remains public.
- DAS3 verifies Supabase JWTs and accepts only teachers.
- DAS7 verifies Supabase JWTs and accepts only parents.
- Both protected backends use the status and anti-enumeration rules in
  `../../API_CONTRACTS.md`.
- DAS7 continues to send production email through Brevo.

## How to read the plan

"Parallel" means separate contributors can work on those lanes at the same time
without waiting for another lane to finish. A single backend integrator can do the
same lanes in any order. "Sequential" means the later work depends on a decision,
schema, or contract produced by the earlier work.

## Phase map

| Phase | Work | Execution |
| --- | --- | --- |
| 0 | Decide the DAS3 production runtime and freeze shared auth names | Sequential gate |
| 1 | Shared Supabase work, DAS1 checks, DAS3 auth scaffolding, DAS7 cleanup | Four parallel lanes |
| 2 | Connect DAS3 auth to profiles and resource ownership | Sequential inside DAS3 |
| 3 | Service test suites | Parallel by backend |
| 4 | Cross-service and frontend contract tests | Sequential after Phases 2 and 3 |
| 5 | Production routing and non-container deployment | One decision, then parallel configuration, then one smoke test |

## Phase 0: settle blocking decisions

This phase must be completed first. Do not build DAS3 authentication until its
production runtime is known.

### 0.1 Choose the DAS3 production runtime

LangGraph's `Auth` hooks work with LangSmith Deployments. LangChain's current
documentation says custom authentication is not available for an ordinary
self-managed open-source server.

Choose one option:

1. Use a LangSmith Deployment. Keep the native thread, run, interrupt, and stream
   API. Implement authentication with `Auth`, `@auth.authenticate`, and `@auth.on`.
2. Run the graph behind an application server owned by the project. Implement JWT
   middleware and persistence in that server. This requires defining which native
   LangGraph endpoints or behaviors the wrapper will expose.

Do not use `langgraph dev` as the production server. It remains suitable for local
development.

Decision output:

- [ ] Record the chosen runtime in `docs/ARCHITECTURE.md`.
- [ ] Record how the frontend reaches threads, runs, interrupts, and streams.
- [ ] Confirm that the chosen runtime works without the discarded Docker and
  Traefik setup.

### 0.2 Freeze shared names and behavior

- [ ] Use the existing Supabase project for both protected services.
- [ ] Keep `insight.parents.auth_user_id` as the DAS7 parent link.
- [ ] Name and document the DAS3 teacher profile table. The recommended name is
  `worksheet.teachers`, with a unique non-null `auth_user_id` referencing
  `auth.users.id`.
- [ ] Keep accounts mutually exclusive through the administrator provisioning
  procedure. Do not add a role claim or token hook unless profile lookups prove to
  be a real performance problem.
- [ ] Agree on `401`, `403`, and `404` behavior before writing tests.

## Phase 1: parallel backend lanes

After Phase 0, all four lanes below can proceed in parallel. The DAS3 lane may use
a fake teacher repository until the shared Supabase lane supplies the real table.

### Lane A: shared Supabase profiles and provisioning

Owner: shared database and account setup.

- [ ] Add the worksheet schema and teacher profile migration beside the project's
  existing Supabase migrations. Do not create a second, unrelated migration
  history for the same Supabase project.
- [ ] Make `auth_user_id` unique and non-null.
- [ ] Keep the table outside the managed `auth` schema.
- [ ] Enable RLS as defense in depth and revoke `anon` and `authenticated` Data API
  access if the frontend does not need it.
- [ ] Do not add a broad `TO authenticated` policy. The frontend is not allowed to
  query the teacher table directly.
- [ ] Write an administrator runbook for inviting a Supabase user and inserting
  either a teacher or parent profile.
- [ ] In the runbook, check the other profile table before insertion so one auth
  user ID cannot be assigned to both groups.
- [ ] Use the Supabase Dashboard or a small backend-only script for the initial
  accounts. Do not build an admin UI for this integration.
- [ ] Document account disablement and removal. Revoke sessions before deleting a
  user when immediate access removal is required.

Verification:

- [ ] A teacher profile can reference an invited auth user.
- [ ] Duplicate `auth_user_id` values are rejected.
- [ ] Browser publishable credentials cannot read teacher or parent profile rows
  directly.
- [ ] Real service-role values exist only in backend `.env` files or the deployment
  secret store.

### Lane B: DAS1 public contract

Owner: `DAS_1/backend/`.

- [ ] Keep all current screening routes public.
- [ ] Confirm that the root Vite proxy removes `/api/screening` and the backend
  continues to serve its routes from `/`.
- [ ] Add or retain an integration test that reaches the backend through the public
  screening prefix.
- [ ] Confirm that no Supabase login is required to start, continue, or finish a
  screening session.
- [ ] Keep future staff dashboards or private result searches out of the public
  router until they receive a separate authorization design.
- [ ] Check that backend-only provider keys do not use a frontend-facing `VITE_`
  name when configuration is cleaned up.

Verification:

- [ ] Anonymous screening smoke test passes.
- [ ] Existing DAS1 unit and integration tests pass.

### Lane C: DAS3 authentication scaffolding

Owner: `DAS_3/`.

Tasks depend on the runtime chosen in Phase 0, but not yet on the real teacher
table.

- [ ] Add environment variables for the Supabase URL and JWT verification method.
- [ ] Prefer asymmetric signing keys and the project JWKS endpoint.
- [ ] Use a maintained JWT library or Supabase `get_claims`; do not implement JWT
  parsing or signature verification manually.
- [ ] Verify signature, issuer, and expiry. Require a non-empty `sub`.
- [ ] Return `401` for missing, malformed, expired, wrong-issuer, or invalidly
  signed tokens.
- [ ] Define a small teacher repository interface with a fake implementation for
  unit tests.
- [ ] Return `403` when a valid Supabase user has no teacher profile.
- [ ] Add the auth handler to `langgraph.json` if using LangSmith Deployment.
- [ ] If using a project-owned application server, mount the middleware before all
  worksheet thread and run routes.
- [ ] Add a protected identity route or equivalent check that the frontend can use
  after teacher login.

Verification with fakes:

- [ ] Missing and invalid tokens return `401`.
- [ ] A valid token with no teacher returns `403`.
- [ ] A valid teacher reaches the protected handler.

### Lane D: DAS7 authorization cleanup

Owner: `DAS_7/backend/`.

- [ ] Add a `ForbiddenError` that produces `403` without exposing profile details.
- [ ] Keep invalid JWTs as `401 Unauthorized`.
- [ ] Change a valid JWT with no `insight.parents` row from `401` to `403`.
- [ ] Keep `requireOwnStudent` and `requireOwnParent` behavior that returns the same
  `404` for absent and unowned records.
- [ ] Add unit tests that distinguish invalid-token `401` from wrong-group `403`.
- [ ] Add an integration test using a teacher auth user with no parent profile.
- [ ] Keep the Brevo and fake email adapters unchanged unless a test exposes a
  regression.

Verification:

- [ ] DAS7 auth unit tests pass.
- [ ] A parent can call `/me`.
- [ ] A teacher receives `403` from `/me`.
- [ ] Student enumeration tests still receive indistinguishable `404` responses.

## Phase 2: finish DAS3 authorization

This phase is sequential inside DAS3. Each step depends on the previous one.

### Step 2.1: connect the real teacher repository

- [ ] Replace the fake repository at application startup with a Supabase-backed
  lookup of `worksheet.teachers.auth_user_id`.
- [ ] Keep the service-role key on the server and disable browser session
  persistence in the server-side client.
- [ ] Return only the teacher fields needed by authorization.
- [ ] Treat database outages as a server or service-availability error, not as
  proof that the user is forbidden.

### Step 2.2: attach authenticated identity

- [ ] Use JWT `sub` as the LangGraph user identity.
- [ ] Put only stable identifiers needed for authorization into the request or
  graph context. Do not place access tokens or provider secrets in graph state.
- [ ] Confirm that the identity is available to thread and run authorization.

### Step 2.3: scope LangGraph resources

If using LangSmith Deployment:

- [ ] Use `@auth.on` to add owner metadata when a thread or resource is created.
- [ ] Return owner filters for search, read, update, and delete operations.
- [ ] Cover threads, runs, assistants, store items, and cron jobs only where DAS3
  uses them. Do not add handlers for unused resource types.

If using a project-owned server:

- [ ] Store the teacher owner ID with every persisted thread or worksheet.
- [ ] Apply the owner filter in repository queries, not after loading another
  user's record.

For either runtime:

- [ ] Make missing and unowned resource IDs indistinguishable.
- [ ] Preserve the existing clarification interrupt and streaming behavior.

### Step 2.4: run the real auth integration tests

- [ ] Teacher A can create, read, continue, and stream their own thread.
- [ ] Teacher B cannot search, read, update, delete, or run Teacher A's thread.
- [ ] A parent token receives `403` before graph execution.
- [ ] Invalid and expired JWTs receive `401`.
- [ ] The protected identity check returns only safe teacher information.

## Phase 3: parallel service verification

Once Phase 2 is complete, run the three service suites in parallel. Failures in one
service do not block investigation in another.

### DAS1 suite

```powershell
npm test --prefix DAS_1
```

### DAS3 suites

```powershell
python -m pytest DAS_3/tests
npm test --prefix DAS_3/frontend
```

Add the DAS3 auth and resource-isolation tests to the Python suite. Tests that use
a real Supabase project must have the same guard pattern as DAS7 and refuse to run
against an unapproved project.

### DAS7 suite

```powershell
npm test --prefix DAS_7/backend
npm run build --prefix DAS_7/backend
```

Keep real Brevo sending disabled in automated tests.

## Phase 4: sequential cross-service verification

Run this phase after all parallel service suites pass and the frontend API clients
are ready.

1. Start DAS1 on port `4173`, DAS3 on `2024`, and DAS7 on `4000`.
2. Start the root Vite frontend on `5173`.
3. Confirm that anonymous screening works.
4. Sign in as a teacher and confirm worksheet access.
5. Sign in as a parent without logging out the teacher and confirm insight access.
6. Send the teacher token to DAS7 and expect `403`.
7. Send the parent token to DAS3 and expect `403`.
8. Confirm that invalid tokens return `401` on both protected services.
9. Probe an unowned resource and a nonexistent resource and compare their `404`
   responses.
10. Run a DAS7 notification with the fake provider. Perform one manual Brevo smoke
    test only in an approved non-test environment.

Do not proceed to deployment until all ten checks pass.

## Phase 5: production routing and deployment

### Sequential decision

Choose one routing model after the hosting provider is known:

1. Same-origin hosting rewrites for the three `/api/*` prefixes.
2. Separate backend URLs with a strict CORS allowlist.

### Parallel configuration

After choosing the model, each backend can be configured and deployed in parallel:

- DAS1 process and screening route.
- DAS3 process and worksheet route.
- DAS7 process, insight route, scheduler, and Brevo secrets.

The frontend can be built in parallel with those deployments after its three API
base URLs are known.

### Sequential production smoke test

Run the Phase 4 flow against the deployed URLs. Only then remove the legacy Docker
and Traefik instructions or files.

## Backend definition of done

- DAS1 remains public and passes its existing tests.
- DAS3 has production-suitable JWT verification, teacher lookup, and resource
  ownership checks.
- DAS7 returns `401`, `403`, and `404` according to the shared contract.
- Parent and teacher accounts remain mutually exclusive through provisioning.
- No frontend code receives a service-role, LLM, or Brevo secret.
- Brevo still handles real DAS7 email.
- Service-level and cross-service tests pass.
- All three backends run without Docker or Traefik.

## References

- [LangGraph custom authentication](https://docs.langchain.com/langsmith/custom-auth)
- [LangGraph resource authorization](https://docs.langchain.com/langsmith/auth)
- [LangGraph custom routes](https://docs.langchain.com/langsmith/custom-routes)
- [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)
- [Supabase user profile tables](https://supabase.com/docs/guides/auth/managing-user-data)
