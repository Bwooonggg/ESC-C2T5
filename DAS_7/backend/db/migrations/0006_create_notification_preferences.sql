-- Phase 3: Parent notification preferences.

CREATE TABLE notification_preferences (
    parent_id VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    frequency VARCHAR(16) NOT NULL,
    recipient_email VARCHAR(254) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (parent_id),
    CONSTRAINT chk_notification_preferences_required_text
        CHECK (
            CHAR_LENGTH(TRIM(parent_id)) > 0
            AND CHAR_LENGTH(TRIM(recipient_email)) > 0
        ),
    CONSTRAINT chk_notification_preferences_normalized_email
        CHECK (
            BINARY recipient_email = BINARY LOWER(TRIM(recipient_email))
        ),
    CONSTRAINT fk_notification_preferences_parent
        FOREIGN KEY (parent_id) REFERENCES parents (parent_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_notification_preferences_enabled
        CHECK (enabled IN (0, 1)),
    CONSTRAINT chk_notification_preferences_frequency
        CHECK (frequency IN ('Weekly', 'Fortnightly', 'Monthly'))
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
