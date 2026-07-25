-- R6B: accept ordinary email domains while preserving normalized addresses.
-- The original constraints used a double-escaped dot in a regular SQL string,
-- which required a literal backslash before the domain separator.

alter table insight.notification_preferences
    drop constraint notification_preferences_email_ck,
    add constraint notification_preferences_email_ck check (
        recipient_email = lower(btrim(recipient_email))
        and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    );

alter table insight.email_notifications
    drop constraint email_notifications_email_ck,
    add constraint email_notifications_email_ck check (
        recipient_email = lower(btrim(recipient_email))
        and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    );
