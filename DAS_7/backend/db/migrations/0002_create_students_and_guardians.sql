-- Phase 3: students and the Parent-is-guardian-of-Student relationship.

CREATE TABLE students (
    student_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    band_level VARCHAR(64) NOT NULL,
    current_progress_version VARCHAR(128) NOT NULL DEFAULT 'v0',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (student_id),
    CONSTRAINT chk_students_required_text
        CHECK (
            CHAR_LENGTH(TRIM(student_id)) > 0
            AND CHAR_LENGTH(TRIM(name)) > 0
            AND CHAR_LENGTH(TRIM(band_level)) > 0
            AND CHAR_LENGTH(TRIM(current_progress_version)) > 0
        )
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;

CREATE TABLE parent_students (
    parent_id VARCHAR(64) NOT NULL,
    student_id VARCHAR(64) NOT NULL,
    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (parent_id, student_id),
    CONSTRAINT chk_parent_students_required_text
        CHECK (
            CHAR_LENGTH(TRIM(parent_id)) > 0
            AND CHAR_LENGTH(TRIM(student_id)) > 0
        ),
    CONSTRAINT fk_parent_students_parent
        FOREIGN KEY (parent_id) REFERENCES parents (parent_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_parent_students_student
        FOREIGN KEY (student_id) REFERENCES students (student_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
