-- R3: DAS7 PostgreSQL schema and durable domain records.
--
-- The schema is intentionally separate from the legacy private schema that
-- exists in the hosted development project. DAS7 does not own Supabase Auth
-- tables, passwords, sessions, or local role assignments.

create schema if not exists insight;

create or replace function insight.set_updated_at()
returns trigger
language plpgsql
set search_path = insight, pg_catalog
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table insight.parent_profiles (
    parent_id uuid primary key,
    auth_user_id uuid not null,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint parent_profiles_auth_user_id_key unique (auth_user_id),
    constraint parent_profiles_name_ck check (btrim(name) <> '')
);

create table insight.student_profiles (
    student_id uuid primary key,
    name text not null,
    date_of_birth date not null,
    band_level text not null,
    current_progress_version bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint student_profiles_name_ck check (btrim(name) <> ''),
    constraint student_profiles_band_level_ck check (btrim(band_level) <> ''),
    constraint student_profiles_progress_version_ck
        check (current_progress_version >= 0)
);

create table insight.parent_students (
    parent_id uuid not null,
    student_id uuid not null,
    assigned_at timestamptz not null default now(),
    primary key (parent_id, student_id),
    constraint parent_students_parent_fkey
        foreign key (parent_id)
        references insight.parent_profiles (parent_id)
        on delete restrict,
    constraint parent_students_student_fkey
        foreign key (student_id)
        references insight.student_profiles (student_id)
        on delete restrict
);

create table insight.progress_records (
    record_id uuid primary key,
    student_id uuid not null,
    assessment_date date not null,
    skill_area text not null,
    score numeric(5, 2) not null,
    notes text not null default '',
    progress_version bigint not null,
    source_system text not null,
    source_record_id text not null,
    source_revision integer not null default 1,
    supersedes_record_id uuid null,
    correction_reason text null,
    created_at timestamptz not null default now(),
    constraint progress_records_student_fkey
        foreign key (student_id)
        references insight.student_profiles (student_id)
        on delete restrict,
    constraint progress_records_supersedes_fkey
        foreign key (supersedes_record_id)
        references insight.progress_records (record_id)
        on delete restrict,
    constraint progress_records_skill_area_ck check (
        skill_area in (
            'Phonological Awareness',
            'Reading Accuracy',
            'Reading Fluency',
            'Spelling',
            'Writing',
            'Comprehension'
        )
    ),
    constraint progress_records_score_ck check (score >= 0 and score <= 100),
    constraint progress_records_progress_version_ck check (progress_version > 0),
    constraint progress_records_source_system_ck check (btrim(source_system) <> ''),
    constraint progress_records_source_record_id_ck
        check (btrim(source_record_id) <> ''),
    constraint progress_records_source_revision_ck check (source_revision > 0),
    constraint progress_records_correction_ck check (
        (supersedes_record_id is null and correction_reason is null)
        or (
            supersedes_record_id is not null
            and correction_reason is not null
            and btrim(correction_reason) <> ''
        )
    ),
    constraint progress_records_source_identity_key
        unique (source_system, source_record_id, source_revision)
);

create table insight.summaries (
    summary_id uuid primary key,
    student_id uuid not null,
    content text not null,
    generated_at timestamptz not null,
    source_progress_version bigint not null,
    provider text null,
    model text null,
    prompt_version text null,
    provider_request_id text null,
    generation_metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint summaries_student_fkey
        foreign key (student_id)
        references insight.student_profiles (student_id)
        on delete restrict,
    constraint summaries_student_identity_key unique (summary_id, student_id),
    constraint summaries_content_ck check (btrim(content) <> ''),
    constraint summaries_progress_version_ck check (source_progress_version > 0),
    constraint summaries_generation_metadata_ck
        check (jsonb_typeof(generation_metadata) = 'object')
);

create table insight.recommendations (
    recommendation_id uuid primary key,
    student_id uuid not null,
    summary_id uuid not null,
    content text not null,
    generated_at timestamptz not null,
    provider text null,
    model text null,
    prompt_version text null,
    provider_request_id text null,
    generation_metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint recommendations_summary_student_fkey
        foreign key (summary_id, student_id)
        references insight.summaries (summary_id, student_id)
        on delete restrict,
    constraint recommendations_content_ck check (btrim(content) <> ''),
    constraint recommendations_generation_metadata_ck
        check (jsonb_typeof(generation_metadata) = 'object')
);

create table insight.notification_preferences (
    parent_id uuid primary key,
    enabled boolean not null default true,
    frequency text not null,
    recipient_email text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint notification_preferences_parent_fkey
        foreign key (parent_id)
        references insight.parent_profiles (parent_id)
        on delete cascade,
    constraint notification_preferences_frequency_ck
        check (frequency in ('Weekly', 'Fortnightly', 'Monthly')),
    constraint notification_preferences_email_ck check (
        recipient_email = lower(btrim(recipient_email))
        and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
    )
);

create table insight.email_notifications (
    notification_id uuid primary key,
    parent_id uuid not null,
    student_id uuid not null,
    summary_id uuid not null,
    recipient_email text not null,
    subject text not null,
    body text not null,
    sent_at timestamptz null,
    sent boolean not null default false,
    provider_message_id text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint email_notifications_parent_student_fkey
        foreign key (parent_id, student_id)
        references insight.parent_students (parent_id, student_id)
        on delete restrict,
    constraint email_notifications_summary_student_fkey
        foreign key (summary_id, student_id)
        references insight.summaries (summary_id, student_id)
        on delete restrict,
    constraint email_notifications_identity_key
        unique (notification_id, parent_id, student_id, summary_id),
    constraint email_notifications_subject_ck check (btrim(subject) <> ''),
    constraint email_notifications_body_ck check (btrim(body) <> ''),
    constraint email_notifications_email_ck check (
        recipient_email = lower(btrim(recipient_email))
        and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
    ),
    constraint email_notifications_sent_state_ck check (
        (sent = false and sent_at is null)
        or (sent = true and sent_at is not null)
    )
);

create table insight.notification_jobs (
    job_id uuid primary key,
    parent_id uuid not null,
    student_id uuid not null,
    summary_id uuid null,
    email_notification_id uuid null,
    scheduled_for timestamptz not null,
    status text not null default 'pending',
    attempts integer not null default 0,
    lease_owner text null,
    lease_expires_at timestamptz null,
    completed_at timestamptz null,
    failed_at timestamptz null,
    retry_at timestamptz null,
    last_error text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint notification_jobs_parent_student_fkey
        foreign key (parent_id, student_id)
        references insight.parent_students (parent_id, student_id)
        on delete restrict,
    constraint notification_jobs_summary_student_fkey
        foreign key (summary_id, student_id)
        references insight.summaries (summary_id, student_id)
        on delete restrict,
    constraint notification_jobs_email_fkey
        foreign key (email_notification_id, parent_id, student_id, summary_id)
        references insight.email_notifications
            (notification_id, parent_id, student_id, summary_id)
        on delete restrict,
    constraint notification_jobs_schedule_key
        unique (parent_id, student_id, scheduled_for),
    constraint notification_jobs_email_key unique (email_notification_id),
    constraint notification_jobs_status_ck
        check (status in ('pending', 'processing', 'completed', 'failed')),
    constraint notification_jobs_attempts_ck check (attempts >= 0),
    constraint notification_jobs_state_ck check (
        (
            status = 'pending'
            and lease_owner is null
            and lease_expires_at is null
            and completed_at is null
            and failed_at is null
            and retry_at is null
            and last_error is null
        )
        or (
            status = 'processing'
            and lease_owner is not null
            and btrim(lease_owner) <> ''
            and lease_expires_at is not null
            and completed_at is null
            and failed_at is null
            and retry_at is null
        )
        or (
            status = 'completed'
            and lease_owner is null
            and lease_expires_at is null
            and completed_at is not null
            and failed_at is null
            and retry_at is null
            and last_error is null
            and summary_id is not null
            and email_notification_id is not null
        )
        or (
            status = 'failed'
            and lease_owner is null
            and lease_expires_at is null
            and completed_at is null
            and failed_at is not null
            and last_error is not null
            and btrim(last_error) <> ''
            and (retry_at is null or retry_at > failed_at)
        )
    )
);

create table insight.idempotency_records (
    scope text not null,
    operation text not null,
    idempotency_key text not null,
    request_hash char(64) not null,
    status text not null default 'processing',
    response_status smallint null,
    response_body jsonb null,
    expires_at timestamptz not null,
    completed_at timestamptz null,
    failed_at timestamptz null,
    created_at timestamptz not null default now(),
    primary key (scope, operation, idempotency_key),
    constraint idempotency_records_scope_ck check (btrim(scope) <> ''),
    constraint idempotency_records_operation_ck check (btrim(operation) <> ''),
    constraint idempotency_records_key_ck check (btrim(idempotency_key) <> ''),
    constraint idempotency_records_hash_ck
        check (request_hash ~ '^[0-9a-fA-F]{64}$'),
    constraint idempotency_records_status_ck
        check (status in ('processing', 'completed', 'failed')),
    constraint idempotency_records_response_status_ck check (
        response_status is null or response_status between 100 and 599
    ),
    constraint idempotency_records_response_body_ck check (
        response_body is null or jsonb_typeof(response_body) = 'object'
    ),
    constraint idempotency_records_state_ck check (
        (
            status = 'processing'
            and response_status is null
            and response_body is null
            and completed_at is null
            and failed_at is null
        )
        or (
            status = 'completed'
            and response_status is not null
            and completed_at is not null
            and failed_at is null
        )
        or (
            status = 'failed'
            and response_status is not null
            and completed_at is null
            and failed_at is not null
        )
    ),
    constraint idempotency_records_expiry_ck
        check (expires_at > created_at)
);

create table insight.audit_events (
    event_id uuid primary key,
    actor_user_id uuid null,
    action text not null,
    entity_type text not null,
    entity_id text not null,
    occurred_at timestamptz not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint audit_events_action_ck check (btrim(action) <> ''),
    constraint audit_events_entity_type_ck check (btrim(entity_type) <> ''),
    constraint audit_events_entity_id_ck check (btrim(entity_id) <> ''),
    constraint audit_events_metadata_ck
        check (jsonb_typeof(metadata) = 'object')
);

create trigger parent_profiles_set_updated_at
before update on insight.parent_profiles
for each row execute function insight.set_updated_at();

create trigger student_profiles_set_updated_at
before update on insight.student_profiles
for each row execute function insight.set_updated_at();

create trigger notification_preferences_set_updated_at
before update on insight.notification_preferences
for each row execute function insight.set_updated_at();

create trigger email_notifications_set_updated_at
before update on insight.email_notifications
for each row execute function insight.set_updated_at();

create trigger notification_jobs_set_updated_at
before update on insight.notification_jobs
for each row execute function insight.set_updated_at();
