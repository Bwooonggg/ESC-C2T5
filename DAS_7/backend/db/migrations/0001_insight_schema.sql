-- 0001_insight_schema.sql — DAS 7 Parent Insight Dashboard.
-- Creates the service-owned `insight` schema and its tables.
-- Idempotent: every statement is guarded, so re-running is safe.

create schema if not exists insight;

create table if not exists insight.parents (
    parent_id     uuid primary key default gen_random_uuid(),
    auth_user_id  uuid unique,
    name          text not null,
    email         text not null,
    mobile_number text not null default ''
);

create table if not exists insight.students (
    student_id    uuid primary key default gen_random_uuid(),
    name          text not null,
    date_of_birth date not null,
    band_level    text not null
);

create table if not exists insight.parent_students (
    parent_id  uuid not null references insight.parents  on delete cascade,
    student_id uuid not null references insight.students on delete cascade,
    primary key (parent_id, student_id)
);

create table if not exists insight.progress_records (
    record_id  uuid primary key default gen_random_uuid(),
    student_id uuid not null references insight.students on delete cascade,
    date       date not null,
    skill_area text not null check (skill_area in ('Phonological Awareness','Reading Accuracy',
                 'Reading Fluency','Spelling','Writing','Comprehension')),
    score      int  not null check (score between 0 and 100),
    notes      text not null default '',
    created_at timestamptz not null default now()
);
create index if not exists progress_records_student_date_idx
    on insight.progress_records (student_id, date);

create table if not exists insight.summaries (
    summary_id   uuid primary key default gen_random_uuid(),
    student_id   uuid not null references insight.students on delete cascade,
    content      text not null,
    generated_at timestamptz not null default now()
);
create index if not exists summaries_student_latest_idx
    on insight.summaries (student_id, generated_at desc);

create table if not exists insight.recommendations (
    recommendation_id uuid primary key default gen_random_uuid(),
    summary_id        uuid not null references insight.summaries on delete cascade,
    content           text not null,
    generated_at      timestamptz not null default now()
);

create table if not exists insight.notification_preferences (
    parent_id       uuid primary key references insight.parents on delete cascade,
    enabled         boolean not null default false,
    frequency       text not null default 'Weekly'
                      check (frequency in ('Weekly','Fortnightly','Monthly')),
    recipient_email text not null
);

create table if not exists insight.email_notifications (
    notification_id uuid primary key default gen_random_uuid(),
    parent_id       uuid not null references insight.parents on delete cascade,
    summary_id      uuid references insight.summaries,
    recipient_email text not null,
    subject         text not null,
    body            text not null,
    sent_at         timestamptz not null default now()
);
create index if not exists email_notifications_parent_latest_idx
    on insight.email_notifications (parent_id, sent_at desc);
