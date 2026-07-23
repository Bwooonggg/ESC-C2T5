-- R3: default-deny access for the exposed DAS7 schema.
-- Policies for parent ownership and trusted ingestion are supplied by the
-- platform/Auth team in the integration phase. Until then, RLS intentionally
-- returns no rows to end-user roles.

alter table insight.parent_profiles enable row level security;
alter table insight.student_profiles enable row level security;
alter table insight.parent_students enable row level security;
alter table insight.progress_records enable row level security;
alter table insight.summaries enable row level security;
alter table insight.recommendations enable row level security;
alter table insight.notification_preferences enable row level security;
alter table insight.email_notifications enable row level security;
alter table insight.notification_jobs enable row level security;
alter table insight.idempotency_records enable row level security;
alter table insight.audit_events enable row level security;

revoke all on schema insight from public, anon, authenticated, service_role;
grant usage on schema insight to authenticated, service_role;

revoke all on all tables in schema insight
    from public, anon, authenticated, service_role;

-- These grants define what the Data API roles may request. RLS policies are
-- deliberately absent until the platform/Auth team supplies the ownership and
-- ingestion claims contract.
grant select on
    insight.parent_profiles,
    insight.student_profiles,
    insight.parent_students,
    insight.progress_records,
    insight.summaries,
    insight.recommendations,
    insight.notification_preferences
to authenticated;

grant insert, update on insight.summaries to authenticated;
grant insert, update on insight.recommendations to authenticated;
grant update on insight.notification_preferences to authenticated;

-- The worker uses the server-only secret key and needs only the operations
-- required to claim jobs, persist generated output, and record delivery state.
grant select, insert, update on
    insight.parent_profiles,
    insight.student_profiles,
    insight.parent_students,
    insight.progress_records,
    insight.summaries,
    insight.recommendations,
    insight.notification_preferences,
    insight.email_notifications,
    insight.notification_jobs,
    insight.idempotency_records
to service_role;

grant select, insert on insight.audit_events to service_role;

-- Audit records are append-only to application roles. Service-role inserts are
-- explicitly granted above; no update/delete grant is provided.
revoke update, delete on insight.audit_events
    from public, anon, authenticated, service_role;

-- Functions in an exposed schema are not callable by default roles. Only the
-- worker's queue state transitions are enabled at this stage. Trusted
-- ingestion callers receive function privileges in the platform integration
-- phase after their JWT/RLS contract is finalized.
revoke all on all functions in schema insight
    from public, anon, authenticated, service_role;

grant execute on function insight.claim_notification_jobs(
    timestamptz,
    timestamptz,
    integer,
    text
) to service_role;

grant execute on function insight.complete_notification_job(
    uuid,
    text,
    timestamptz
) to service_role;

grant execute on function insight.fail_notification_job(
    uuid,
    text,
    timestamptz,
    timestamptz,
    text
) to service_role;

alter default privileges in schema insight
    revoke all on tables from public, anon, authenticated, service_role;

alter default privileges in schema insight
    revoke execute on functions from public, anon, authenticated, service_role;
