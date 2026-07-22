-- Phase 3: ProgressRecord persistence.

CREATE TABLE progress_records (
    record_id VARCHAR(64) NOT NULL,
    student_id VARCHAR(64) NOT NULL,
    assessment_date DATE NOT NULL,
    skill_area VARCHAR(64) NOT NULL,
    score DECIMAL(5, 2) NOT NULL,
    notes TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (record_id),
    CONSTRAINT chk_progress_records_required_text
        CHECK (
            CHAR_LENGTH(TRIM(record_id)) > 0
            AND CHAR_LENGTH(TRIM(student_id)) > 0
            AND CHAR_LENGTH(TRIM(skill_area)) > 0
        ),
    CONSTRAINT fk_progress_records_student
        FOREIGN KEY (student_id) REFERENCES students (student_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_progress_records_skill_area
        CHECK (
            skill_area IN (
                'Phonological Awareness',
                'Reading Accuracy',
                'Reading Fluency',
                'Spelling',
                'Writing',
                'Comprehension'
            )
        ),
    CONSTRAINT chk_progress_records_score
        CHECK (score >= 0 AND score <= 100)
) ENGINE = InnoDB
    DEFAULT CHARACTER SET utf8mb4
    COLLATE = utf8mb4_unicode_ci;
