-- Phase 3, step 4: query-driven secondary indexes.
-- Foreign-key support indexes and primary/unique indexes are defined with the
-- tables; this migration adds indexes for recurring read and worker queries.

ALTER TABLE parent_students
    ADD INDEX idx_parent_students_student
        (student_id, parent_id);

ALTER TABLE progress_records
    ADD INDEX idx_progress_records_student_date
        (student_id, assessment_date, record_id);

ALTER TABLE summaries
    ADD INDEX idx_summaries_student_generated
        (student_id, generated_at, summary_id);

ALTER TABLE recommendations
    ADD INDEX idx_recommendations_student_generated
        (student_id, generated_at, recommendation_id);

ALTER TABLE notification_preferences
    ADD INDEX idx_notification_preferences_enabled_frequency
        (enabled, frequency, parent_id);

ALTER TABLE email_notifications
    ADD INDEX idx_email_notifications_pending
        (sent, created_at, notification_id);

ALTER TABLE notification_jobs
    ADD INDEX idx_notification_jobs_pending_schedule
        (status, scheduled_for, job_id),
    ADD INDEX idx_notification_jobs_retry
        (status, retry_at, job_id),
    ADD INDEX idx_notification_jobs_lease
        (status, lease_expires_at, job_id);

ALTER TABLE audit_events
    ADD INDEX idx_audit_events_entity
        (entity_type, entity_id, occurred_at, event_id),
    ADD INDEX idx_audit_events_actor
        (actor_user_id, occurred_at, event_id);

ALTER TABLE idempotency_records
    ADD INDEX idx_idempotency_records_expiry
        (expires_at);
