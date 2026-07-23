-- R3: indexes are based on the approved read, ingestion, and worker queries.
-- Primary-key and unique-constraint indexes are created with their tables.

create index parent_students_student_parent_idx
    on insight.parent_students (student_id, parent_id);

create index progress_records_student_date_idx
    on insight.progress_records (student_id, assessment_date, record_id);

create index progress_records_source_lookup_idx
    on insight.progress_records (source_system, source_record_id, source_revision);

create index summaries_student_latest_idx
    on insight.summaries (student_id, generated_at desc, summary_id);

create index recommendations_student_history_idx
    on insight.recommendations (student_id, generated_at desc, recommendation_id);

create index recommendations_summary_idx
    on insight.recommendations (summary_id, student_id, generated_at desc);

create index notification_preferences_enabled_idx
    on insight.notification_preferences (enabled, frequency, parent_id)
    where enabled = true;

create index email_notifications_pending_idx
    on insight.email_notifications (created_at, notification_id)
    where sent = false;

create index email_notifications_parent_student_idx
    on insight.email_notifications (parent_id, student_id, created_at desc);

create index email_notifications_summary_student_idx
    on insight.email_notifications (summary_id, student_id, created_at desc);

create index notification_jobs_pending_schedule_idx
    on insight.notification_jobs (scheduled_for, job_id)
    where status = 'pending';

create index notification_jobs_retry_idx
    on insight.notification_jobs (retry_at, job_id)
    where status = 'failed' and retry_at is not null;

create index notification_jobs_lease_idx
    on insight.notification_jobs (lease_expires_at, job_id)
    where status = 'processing';

create index notification_jobs_summary_student_idx
    on insight.notification_jobs (summary_id, student_id)
    where summary_id is not null;

create index audit_events_entity_idx
    on insight.audit_events (entity_type, entity_id, occurred_at, event_id);

create index audit_events_actor_idx
    on insight.audit_events (actor_user_id, occurred_at, event_id)
    where actor_user_id is not null;

create index idempotency_records_expiry_idx
    on insight.idempotency_records (expires_at);
