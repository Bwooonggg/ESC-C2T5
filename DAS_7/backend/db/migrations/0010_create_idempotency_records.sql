-- Phase 3: idempotency support for future ingestion mutations.

CREATE TABLE idempotency_records (
    scope VARCHAR(128) NOT NULL,
    operation VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'processing',
    response_status SMALLINT UNSIGNED NULL,
    response_body JSON NULL,
    expires_at DATETIME(3) NOT NULL,
    completed_at DATETIME(3) NULL,
    failed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (scope, operation, idempotency_key),
    CONSTRAINT chk_idempotency_records_required_text
        CHECK (
            CHAR_LENGTH(TRIM(scope)) > 0
            AND CHAR_LENGTH(TRIM(operation)) > 0
            AND CHAR_LENGTH(TRIM(idempotency_key)) > 0
            AND CHAR_LENGTH(TRIM(request_hash)) > 0
        ),
    CONSTRAINT chk_idempotency_records_response_status
        CHECK (
            response_status IS NULL
            OR response_status BETWEEN 100 AND 599
        ),
    CONSTRAINT chk_idempotency_records_status
        CHECK (status IN ('processing', 'completed', 'failed')),
    CONSTRAINT chk_idempotency_records_state
        CHECK (
            (
                status = 'processing'
                AND response_status IS NULL
                AND response_body IS NULL
                AND completed_at IS NULL
                AND failed_at IS NULL
            )
            OR (
                status = 'completed'
                AND response_status IS NOT NULL
                AND completed_at IS NOT NULL
                AND failed_at IS NULL
            )
            OR (
                status = 'failed'
                AND response_status IS NOT NULL
                AND completed_at IS NULL
                AND failed_at IS NOT NULL
            )
        ),
    CONSTRAINT chk_idempotency_records_expiry
        CHECK (expires_at > created_at)
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
