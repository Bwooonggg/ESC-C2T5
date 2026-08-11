-- 0003_email_notifications_summary_fk.sql
--
-- `email_notifications.summary_id` was created as a plain nullable reference with
-- no delete rule, which defaults to NO ACTION. That makes the notification log
-- pin summaries in place:
--
--     ERROR: 23503: update or delete on table "summaries" violates foreign key
--     constraint "email_notifications_summary_id_fkey"
--
-- Summaries are regenerable content — deleting them to force a fresh generation is
-- a normal operation. The notification log is a record that an email was sent, and
-- that record stays true whether or not the summary it quoted still exists. The
-- column is already nullable, so ON DELETE SET NULL is the honest rule: keep the
-- log row, forget which summary it referenced.
--
-- (`recommendations.summary_id` already cascades, which is right for the opposite
-- reason — a recommendation has no meaning without the summary it was derived from.)
--
-- Idempotent — safe to re-run.

alter table insight.email_notifications
    drop constraint if exists email_notifications_summary_id_fkey;

alter table insight.email_notifications
    add constraint email_notifications_summary_id_fkey
    foreign key (summary_id) references insight.summaries (summary_id)
    on delete set null;
