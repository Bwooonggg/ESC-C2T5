-- Phase 3: audit trail for future staff/system ingestion operations.

CREATE TABLE audit_events (
    event_id VARCHAR(64) NOT NULL,
    actor_user_id VARCHAR(64) NULL,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    occurred_at DATETIME(3) NOT NULL,
    metadata JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (event_id),
    CONSTRAINT chk_audit_events_required_text
        CHECK (
            CHAR_LENGTH(TRIM(event_id)) > 0
            AND CHAR_LENGTH(TRIM(action)) > 0
            AND CHAR_LENGTH(TRIM(entity_type)) > 0
            AND CHAR_LENGTH(TRIM(entity_id)) > 0
            AND (
                actor_user_id IS NULL
                OR CHAR_LENGTH(TRIM(actor_user_id)) > 0
            )
        ),
    CONSTRAINT fk_audit_events_actor
        FOREIGN KEY (actor_user_id) REFERENCES users (user_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
