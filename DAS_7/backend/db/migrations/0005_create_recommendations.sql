-- Phase 3: Recommendation persistence and its basis Summary.

CREATE TABLE recommendations (
    recommendation_id VARCHAR(64) NOT NULL,
    student_id VARCHAR(64) NOT NULL,
    summary_id VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    generated_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (recommendation_id),
    CONSTRAINT chk_recommendations_required_text
        CHECK (
            CHAR_LENGTH(TRIM(recommendation_id)) > 0
            AND CHAR_LENGTH(TRIM(student_id)) > 0
            AND CHAR_LENGTH(TRIM(summary_id)) > 0
            AND CHAR_LENGTH(TRIM(content)) > 0
        ),
    CONSTRAINT fk_recommendations_summary_student
        FOREIGN KEY (summary_id, student_id)
        REFERENCES summaries (summary_id, student_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
