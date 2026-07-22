-- Phase 3: durable periodic notification work.

CREATE TABLE notification_jobs (
    job_id VARCHAR(64) NOT NULL,
    parent_id VARCHAR(64) NOT NULL,
    student_id VARCHAR(64) NOT NULL,
    summary_id VARCHAR(64) NULL,
    email_notification_id VARCHAR(64) NULL,
    scheduled_for DATETIME(3) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    lease_expires_at DATETIME(3) NULL,
    completed_at DATETIME(3) NULL,
    failed_at DATETIME(3) NULL,
    retry_at DATETIME(3) NULL,
    last_error TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (job_id),
    UNIQUE KEY uq_notification_jobs_schedule
        (parent_id, student_id, scheduled_for),
    UNIQUE KEY uq_notification_jobs_email_notification
        (email_notification_id),
    CONSTRAINT chk_notification_jobs_required_text
        CHECK (
            CHAR_LENGTH(TRIM(job_id)) > 0
            AND CHAR_LENGTH(TRIM(parent_id)) > 0
            AND CHAR_LENGTH(TRIM(student_id)) > 0
            AND CHAR_LENGTH(TRIM(status)) > 0
            AND (
                summary_id IS NULL
                OR CHAR_LENGTH(TRIM(summary_id)) > 0
            )
            AND (
                email_notification_id IS NULL
                OR CHAR_LENGTH(TRIM(email_notification_id)) > 0
            )
            AND (
                last_error IS NULL
                OR CHAR_LENGTH(TRIM(last_error)) > 0
            )
        ),
    CONSTRAINT chk_notification_jobs_output_links
        CHECK (
            email_notification_id IS NULL
            OR summary_id IS NOT NULL
        ),
    CONSTRAINT fk_notification_jobs_guardian
        FOREIGN KEY (parent_id, student_id)
        REFERENCES parent_students (parent_id, student_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_notification_jobs_summary_student
        FOREIGN KEY (summary_id, student_id)
        REFERENCES summaries (summary_id, student_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_notification_jobs_email_notification
        FOREIGN KEY (email_notification_id, parent_id, summary_id)
        REFERENCES email_notifications
            (notification_id, parent_id, summary_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_notification_jobs_status
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT chk_notification_jobs_state
        CHECK (
            (
                status = 'pending'
                AND lease_expires_at IS NULL
                AND completed_at IS NULL
                AND failed_at IS NULL
                AND retry_at IS NULL
                AND last_error IS NULL
            )
            OR (
                status = 'processing'
                AND lease_expires_at IS NOT NULL
                AND completed_at IS NULL
                AND retry_at IS NULL
            )
            OR (
                status = 'completed'
                AND lease_expires_at IS NULL
                AND completed_at IS NOT NULL
                AND failed_at IS NULL
                AND retry_at IS NULL
                AND last_error IS NULL
                AND summary_id IS NOT NULL
                AND email_notification_id IS NOT NULL
            )
            OR (
                status = 'failed'
                AND lease_expires_at IS NULL
                AND completed_at IS NULL
                AND failed_at IS NOT NULL
                AND last_error IS NOT NULL
                AND (
                    retry_at IS NULL
                    OR retry_at > failed_at
                )
            )
        )
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
