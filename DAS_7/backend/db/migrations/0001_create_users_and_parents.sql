-- Phase 3: identity and parent records.
-- Authentication behavior is deferred, but these columns preserve the domain shape.

CREATE TABLE users (
    user_id VARCHAR(64) NOT NULL,
    email VARCHAR(254) NOT NULL,
    mobile_number VARCHAR(32) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    account_type VARCHAR(16) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email),
    CONSTRAINT chk_users_required_text
        CHECK (
            CHAR_LENGTH(TRIM(user_id)) > 0
            AND CHAR_LENGTH(TRIM(email)) > 0
            AND CHAR_LENGTH(TRIM(mobile_number)) > 0
            AND CHAR_LENGTH(TRIM(password_hash)) > 0
        ),
    CONSTRAINT chk_users_normalized_email
        CHECK (BINARY email = BINARY LOWER(TRIM(email))),
    CONSTRAINT chk_users_account_type
        CHECK (account_type IN ('parent', 'staff', 'system')),
    CONSTRAINT chk_users_is_verified
        CHECK (is_verified IN (0, 1))
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;

CREATE TABLE parents (
    parent_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (parent_id),
    UNIQUE KEY uq_parents_user_id (user_id),
    CONSTRAINT chk_parents_required_text
        CHECK (
            CHAR_LENGTH(TRIM(parent_id)) > 0
            AND CHAR_LENGTH(TRIM(user_id)) > 0
            AND CHAR_LENGTH(TRIM(name)) > 0
        ),
    CONSTRAINT fk_parents_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
