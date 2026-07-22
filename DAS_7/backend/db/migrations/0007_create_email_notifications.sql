-- Phase 3: EmailNotification records and delivery state.

CREATE TABLE email_notifications (
    notification_id VARCHAR(64) NOT NULL,
    parent_id VARCHAR(64) NOT NULL,
    summary_id VARCHAR(64) NOT NULL,
    recipient_email VARCHAR(254) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    sent_at DATETIME(3) NULL,
    sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (notification_id),
    UNIQUE KEY uq_email_notifications_identity
        (notification_id, parent_id, summary_id),
    CONSTRAINT chk_email_notifications_required_text
        CHECK (
            CHAR_LENGTH(TRIM(notification_id)) > 0
            AND CHAR_LENGTH(TRIM(parent_id)) > 0
            AND CHAR_LENGTH(TRIM(summary_id)) > 0
            AND CHAR_LENGTH(TRIM(recipient_email)) > 0
            AND CHAR_LENGTH(TRIM(subject)) > 0
            AND CHAR_LENGTH(TRIM(body)) > 0
        ),
    CONSTRAINT chk_email_notifications_normalized_email
        CHECK (
            BINARY recipient_email = BINARY LOWER(TRIM(recipient_email))
        ),
    CONSTRAINT fk_email_notifications_parent
        FOREIGN KEY (parent_id) REFERENCES parents (parent_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_email_notifications_summary
        FOREIGN KEY (summary_id) REFERENCES summaries (summary_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_email_notifications_sent_state
        CHECK (
            (sent = FALSE AND sent_at IS NULL)
            OR (sent = TRUE AND sent_at IS NOT NULL)
        )
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
