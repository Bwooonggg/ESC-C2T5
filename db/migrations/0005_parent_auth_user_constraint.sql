-- 0005_parent_auth_user_constraint.sql
--
-- Every parent profile belongs to exactly one Supabase Auth account. Existing
-- deployments must remove or link any null values before applying this migration.

alter table insight.parents
    alter column auth_user_id set not null;

alter table insight.parents
    drop constraint if exists parents_auth_user_id_fkey;

alter table insight.parents
    add constraint parents_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users (id)
    on delete cascade;

-- Reassert the profile table's existing defense-in-depth settings explicitly.
alter table insight.parents enable row level security;
revoke all privileges on table insight.parents from anon, authenticated;
