# DAS 7 Database Schema

This document records the relational design for the initial MySQL schema. The
SQL definitions live in `backend/db/migrations/` and use MySQL 8 with InnoDB.

## Design decisions

- Domain identifiers are opaque strings stored as `VARCHAR(64)`.
- Email values are stored in their normalized lowercase form. The domain
  normalizes them before persistence and the relevant tables reject values
  containing surrounding whitespace or uppercase characters.
- `DATE` is used for assessment and birth dates without a time component.
- UTC `DATETIME(3)` values are used for generated, delivery, scheduling, and
  audit timestamps. The application is responsible for writing UTC values.
- `password_hash` and `is_verified` remain structural `User` fields. Password
  hashing, login, verification, sessions, and authorization are deferred to the
  final authentication phase.
- Progress scores are limited to two decimal places in both the domain and
  database.
- `students.current_progress_version` is updated in the same transaction as a
  progress mutation. A summary stores the version it read as a snapshot; the
  database does not make that snapshot unique because scheduled notifications
  may generate multiple fresh summaries from unchanged progress.
- The domain `Student` carries the current version marker when it is loaded;
  new students begin at `v0`, and progress mutations replace it transactionally
  with the next application-generated version.
- Summary-producing workflows read records and the marker as one snapshot and
  verify the marker again before saving; a stale generated result is discarded
  or regenerated rather than being presented as current.
- Query-driven secondary indexes are defined in
  `0011_add_query_indexes.sql`. Primary keys, unique constraints, and
  foreign-key support indexes remain part of the relational foundation.

## Tables and domain mapping

| Table | Domain mapping | Main constraints |
| --- | --- | --- |
| `users` | `User` | Unique normalized email; account type is `parent`, `staff`, or `system`. |
| `parents` | `Parent` specialization of `User` | One parent row per user. |
| `students` | `Student` | Required name, date of birth, band level, and current progress version. |
| `parent_students` | Guardian relationship | Composite primary key prevents duplicate guardian assignments; the logical `1..*` minimum is enforced by application workflows. |
| `progress_records` | `ProgressRecord` | Student foreign key; skill-area allow-list; score from 0 to 100 with at most two decimal places. |
| `summaries` | `Summary` | Student foreign key; stores the source progress version read by that generation. |
| `recommendations` | `Recommendation` | Composite foreign key ensures its summary belongs to the same student. |
| `notification_preferences` | `NotificationPreference` | One preference row per parent; normalized recipient email; frequency allow-list. |
| `email_notifications` | `EmailNotification` | Parent and summary foreign keys; normalized recipient email; sent and `sent_at` must agree. |
| `notification_jobs` | Worker scheduling support | Only guardian pairs can receive jobs; each job links to its generated summary/email; status, lease, retry, and terminal timestamps are constrained. |
| `audit_events` | Ingestion/audit support | Optional actor user; JSON metadata; immutable event identity. |
| `idempotency_records` | Ingestion safety support | One request key per scope and operation; terminal results retain status and completion/failure timestamps. |

## Secondary indexes

The secondary indexes support the read and worker query shapes described by the
ports and architecture. They are kept in a separate migration so the base
table definitions remain easy to review.

| Table | Index | Query shape supported |
| --- | --- | --- |
| `parent_students` | `idx_parent_students_student` | Find all guardians for a student. |
| `progress_records` | `idx_progress_records_student_date` | Load a student's records in assessment-date order. |
| `summaries` | `idx_summaries_student_generated` | Find a student's latest summary or summary history. |
| `recommendations` | `idx_recommendations_student_generated` | List a student's recommendations in generation order. |
| `notification_preferences` | `idx_notification_preferences_enabled_frequency` | Find enabled preferences by schedule frequency. |
| `email_notifications` | `idx_email_notifications_pending` | Find unsent notifications in creation order. |
| `notification_jobs` | `idx_notification_jobs_pending_schedule` | Claim pending jobs by their original schedule. |
| `notification_jobs` | `idx_notification_jobs_retry` | Find failed jobs whose retry time is due. |
| `notification_jobs` | `idx_notification_jobs_lease` | Recover processing jobs whose lease expired. |
| `audit_events` | `idx_audit_events_entity` | Investigate changes for a domain entity. |
| `audit_events` | `idx_audit_events_actor` | Investigate events by actor. |
| `idempotency_records` | `idx_idempotency_records_expiry` | Remove or inspect expired idempotency records. |

## Relationship rules

```text
users 1 ---- 0..1 parents
parents 1..* ---- 1..* students  (parent_students)
students 1 ---- 0..* progress_records
students 1 ---- 0..* summaries
summaries 1 ---- 0..* recommendations
parents 1 ---- 0..* email_notifications
summaries 1 ---- 0..* email_notifications
parents 1 ---- 0..1 notification_preferences
parent_students 1 ---- 0..* notification_jobs
users 0..1 ---- 0..* audit_events
```

The guardian association is many-to-many as shown in the class diagram. The
database prevents duplicate assignments and prevents deleting a referenced
parent or student, while the ingestion workflow controls assignment removal
and must ensure that active parents and students satisfy the diagram's `1..*`
minimum.

Guardian authorization remains an application-level rule for operations whose
row shape does not carry a `student_id`, such as an email notification that
references a summary. The database still enforces every direct relationship.

Idempotency keys are scoped by the caller/client scope and operation. There is
no `operations` table; `scope` and `operation` are stored strings used to form
the idempotency key.

## Migration order

1. Users and parents
2. Students and guardian relationships
3. Progress records
4. Summaries
5. Recommendations
6. Notification preferences
7. Email notifications
8. Notification jobs
9. Audit events
10. Idempotency records
11. Query-driven secondary indexes

Authentication session/verification tables are intentionally absent and will be
added during the final authentication integration phase.

The migration runner also creates `schema_migrations` as operational metadata.
It is not part of the domain model or the diagram relationships.
