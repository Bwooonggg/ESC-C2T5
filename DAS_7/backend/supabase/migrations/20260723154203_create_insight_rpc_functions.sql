-- R3: atomic operations that must not be split across Data API calls.
-- All functions are SECURITY INVOKER. Access is granted explicitly in the
-- following security migration after RLS and table privileges are defined.

create or replace function insight._write_progress_record(
    p_scope text,
    p_operation text,
    p_idempotency_key text,
    p_request_hash text,
    p_expires_at timestamptz,
    p_event_id uuid,
    p_record_id uuid,
    p_student_id uuid,
    p_assessment_date date,
    p_skill_area text,
    p_score numeric,
    p_notes text,
    p_source_system text,
    p_source_record_id text,
    p_source_revision integer,
    p_supersedes_record_id uuid,
    p_correction_reason text,
    p_actor_subject uuid,
    p_action text
)
returns jsonb
language plpgsql
security invoker
set search_path = insight, pg_catalog
as $$
declare
    v_idempotency insight.idempotency_records%rowtype;
    v_current_version bigint;
    v_next_version bigint;
    v_response jsonb;
begin
    p_scope := btrim(p_scope);
    p_operation := btrim(p_operation);
    p_idempotency_key := btrim(p_idempotency_key);
    p_request_hash := lower(btrim(p_request_hash));
    p_source_system := btrim(p_source_system);
    p_source_record_id := btrim(p_source_record_id);

    if p_expires_at <= clock_timestamp() then
        raise exception 'idempotency expiry must be in the future'
            using errcode = '22023';
    end if;

    if p_request_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'request hash must be a SHA-256 hexadecimal value'
            using errcode = '22023';
    end if;

    insert into insight.idempotency_records (
        scope,
        operation,
        idempotency_key,
        request_hash,
        status,
        expires_at
    )
    values (
        p_scope,
        p_operation,
        p_idempotency_key,
        p_request_hash,
        'processing',
        p_expires_at
    )
    on conflict (scope, operation, idempotency_key) do nothing
    returning * into v_idempotency;

    if not found then
        select *
        into v_idempotency
        from insight.idempotency_records
        where scope = p_scope
            and operation = p_operation
            and idempotency_key = p_idempotency_key
        for update;

        if not found then
            raise exception 'idempotency record could not be loaded'
                using errcode = '40001';
        end if;

        if v_idempotency.request_hash::text <> p_request_hash then
            raise exception 'idempotency key was reused with a different request'
                using errcode = '23505';
        end if;

        if v_idempotency.status = 'completed' then
            return coalesce(v_idempotency.response_body, '{}'::jsonb);
        end if;

        if v_idempotency.status = 'processing' then
            raise exception 'idempotency request is already processing'
                using errcode = '55P03';
        end if;

        update insight.idempotency_records
        set
            status = 'processing',
            response_status = null,
            response_body = null,
            completed_at = null,
            failed_at = null,
            expires_at = p_expires_at
        where scope = p_scope
            and operation = p_operation
            and idempotency_key = p_idempotency_key;
    end if;

    select current_progress_version
    into v_current_version
    from insight.student_profiles
    where student_id = p_student_id
    for update;

    if not found then
        raise exception 'student projection does not exist'
            using errcode = '23503';
    end if;

    if p_supersedes_record_id is not null then
        perform 1
        from insight.progress_records
        where record_id = p_supersedes_record_id
            and student_id = p_student_id;

        if not found then
            raise exception 'superseded progress record does not belong to student'
                using errcode = '23503';
        end if;
    end if;

    v_next_version := v_current_version + 1;

    insert into insight.progress_records (
        record_id,
        student_id,
        assessment_date,
        skill_area,
        score,
        notes,
        progress_version,
        source_system,
        source_record_id,
        source_revision,
        supersedes_record_id,
        correction_reason
    )
    values (
        p_record_id,
        p_student_id,
        p_assessment_date,
        p_skill_area,
        p_score,
        p_notes,
        v_next_version,
        p_source_system,
        p_source_record_id,
        p_source_revision,
        p_supersedes_record_id,
        p_correction_reason
    );

    update insight.student_profiles
    set current_progress_version = v_next_version
    where student_id = p_student_id;

    insert into insight.audit_events (
        event_id,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        occurred_at,
        metadata
    )
    values (
        p_event_id,
        p_actor_subject,
        p_action,
        'progress_record',
        p_record_id::text,
        clock_timestamp(),
        jsonb_build_object(
            'student_id', p_student_id,
            'progress_version', v_next_version,
            'source_system', p_source_system,
            'source_record_id', p_source_record_id,
            'source_revision', p_source_revision,
            'supersedes_record_id', p_supersedes_record_id
        )
    );

    v_response := jsonb_build_object(
        'record_id', p_record_id,
        'student_id', p_student_id,
        'progress_version', v_next_version
    );

    update insight.idempotency_records
    set
        status = 'completed',
        response_status = 201,
        response_body = v_response,
        completed_at = clock_timestamp(),
        failed_at = null
    where scope = p_scope
        and operation = p_operation
        and idempotency_key = p_idempotency_key;

    return v_response;
end;
$$;

create or replace function insight.insert_progress_record(
    p_scope text,
    p_operation text,
    p_idempotency_key text,
    p_request_hash text,
    p_expires_at timestamptz,
    p_event_id uuid,
    p_record_id uuid,
    p_student_id uuid,
    p_assessment_date date,
    p_skill_area text,
    p_score numeric,
    p_notes text,
    p_source_system text,
    p_source_record_id text,
    p_source_revision integer,
    p_actor_subject uuid
)
returns jsonb
language sql
security invoker
set search_path = insight, pg_catalog
as $$
    select insight._write_progress_record(
        p_scope,
        p_operation,
        p_idempotency_key,
        p_request_hash,
        p_expires_at,
        p_event_id,
        p_record_id,
        p_student_id,
        p_assessment_date,
        p_skill_area,
        p_score,
        p_notes,
        p_source_system,
        p_source_record_id,
        p_source_revision,
        null::uuid,
        null::text,
        p_actor_subject,
        'progress_record.insert'
    );
$$;

create or replace function insight.correct_progress_record(
    p_scope text,
    p_operation text,
    p_idempotency_key text,
    p_request_hash text,
    p_expires_at timestamptz,
    p_event_id uuid,
    p_record_id uuid,
    p_student_id uuid,
    p_assessment_date date,
    p_skill_area text,
    p_score numeric,
    p_notes text,
    p_source_system text,
    p_source_record_id text,
    p_source_revision integer,
    p_supersedes_record_id uuid,
    p_correction_reason text,
    p_actor_subject uuid
)
returns jsonb
language sql
security invoker
set search_path = insight, pg_catalog
as $$
    select insight._write_progress_record(
        p_scope,
        p_operation,
        p_idempotency_key,
        p_request_hash,
        p_expires_at,
        p_event_id,
        p_record_id,
        p_student_id,
        p_assessment_date,
        p_skill_area,
        p_score,
        p_notes,
        p_source_system,
        p_source_record_id,
        p_source_revision,
        p_supersedes_record_id,
        p_correction_reason,
        p_actor_subject,
        'progress_record.correct'
    );
$$;

create or replace function insight.claim_notification_jobs(
    p_now timestamptz,
    p_lease_expires_at timestamptz,
    p_limit integer,
    p_lease_owner text
)
returns setof insight.notification_jobs
language plpgsql
security invoker
set search_path = insight, pg_catalog
as $$
begin
    if p_limit is null or p_limit < 1 then
        raise exception 'job claim limit must be positive'
            using errcode = '22023';
    end if;

    if p_lease_expires_at <= p_now then
        raise exception 'job lease must expire after the claim time'
            using errcode = '22023';
    end if;

    if p_lease_owner is null or btrim(p_lease_owner) = '' then
        raise exception 'job lease owner is required'
            using errcode = '22023';
    end if;

    return query
    with candidates as (
        select job_id
        from insight.notification_jobs
        where (
            status = 'pending'
            and scheduled_for <= p_now
        )
        or (
            status = 'failed'
            and retry_at is not null
            and retry_at <= p_now
        )
        or (
            status = 'processing'
            and lease_expires_at is not null
            and lease_expires_at <= p_now
        )
        order by scheduled_for asc, job_id asc
        for update skip locked
        limit p_limit
    ), claimed as (
        update insight.notification_jobs as jobs
        set
            status = 'processing',
            attempts = jobs.attempts + 1,
            lease_owner = btrim(p_lease_owner),
            lease_expires_at = p_lease_expires_at,
            completed_at = null,
            failed_at = null,
            retry_at = null,
            last_error = null
        from candidates
        where jobs.job_id = candidates.job_id
        returning jobs.*
    )
    select *
    from claimed
    order by scheduled_for asc, job_id asc;
end;
$$;

create or replace function insight.complete_notification_job(
    p_job_id uuid,
    p_lease_owner text,
    p_completed_at timestamptz
)
returns insight.notification_jobs
language plpgsql
security invoker
set search_path = insight, pg_catalog
as $$
declare
    v_job insight.notification_jobs;
begin
    update insight.notification_jobs
    set
        status = 'completed',
        lease_owner = null,
        lease_expires_at = null,
        completed_at = p_completed_at,
        failed_at = null,
        retry_at = null,
        last_error = null
    where job_id = p_job_id
        and status = 'processing'
        and lease_owner = btrim(p_lease_owner)
    returning * into v_job;

    if not found then
        raise exception 'notification job is not owned or is not processing'
            using errcode = '40001';
    end if;

    return v_job;
end;
$$;

create or replace function insight.fail_notification_job(
    p_job_id uuid,
    p_lease_owner text,
    p_failed_at timestamptz,
    p_retry_at timestamptz,
    p_reason text
)
returns insight.notification_jobs
language plpgsql
security invoker
set search_path = insight, pg_catalog
as $$
declare
    v_job insight.notification_jobs;
begin
    if p_reason is null or btrim(p_reason) = '' then
        raise exception 'notification failure reason is required'
            using errcode = '22023';
    end if;

    if p_retry_at is not null and p_retry_at <= p_failed_at then
        raise exception 'retry time must be after failure time'
            using errcode = '22023';
    end if;

    update insight.notification_jobs
    set
        status = 'failed',
        lease_owner = null,
        lease_expires_at = null,
        completed_at = null,
        failed_at = p_failed_at,
        retry_at = p_retry_at,
        last_error = btrim(p_reason)
    where job_id = p_job_id
        and status = 'processing'
        and lease_owner = btrim(p_lease_owner)
    returning * into v_job;

    if not found then
        raise exception 'notification job is not owned or is not processing'
            using errcode = '40001';
    end if;

    return v_job;
end;
$$;
