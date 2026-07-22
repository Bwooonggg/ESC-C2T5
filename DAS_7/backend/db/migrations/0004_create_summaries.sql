-- Phase 3: immutable Summary history.

CREATE TABLE summaries (
    summary_id VARCHAR(64) NOT NULL,
    student_id VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    generated_at DATETIME(3) NOT NULL,
    source_progress_version VARCHAR(128) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (summary_id),
    UNIQUE KEY uq_summaries_id_student (summary_id, student_id),
    CONSTRAINT chk_summaries_required_text
        CHECK (
            CHAR_LENGTH(TRIM(summary_id)) > 0
            AND CHAR_LENGTH(TRIM(student_id)) > 0
            AND CHAR_LENGTH(TRIM(content)) > 0
            AND CHAR_LENGTH(TRIM(source_progress_version)) > 0
        ),
    CONSTRAINT fk_summaries_student
        FOREIGN KEY (student_id) REFERENCES students (student_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
