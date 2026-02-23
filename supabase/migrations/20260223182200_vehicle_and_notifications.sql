-- TPRT - Vehicle fields + notification jobs (email reminders, ops, planilla)

begin;

-- Vehicle fields (holds)
alter table public.booking_holds
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_year integer;

-- Vehicle fields (bookings)
alter table public.bookings
  add column if not exists vehicle_plate text,
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_year integer;

-- RPC updates to support vehicle details at checkout
drop function if exists public.attach_customer_to_hold(uuid, text, citext, text, text);
create or replace function public.attach_customer_to_hold(
  p_hold_id uuid,
  p_customer_name text,
  p_email citext,
  p_phone text,
  p_vehicle_plate text default null,
  p_vehicle_make text default null,
  p_vehicle_model text default null,
  p_vehicle_year integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_booking_holds();

  update public.booking_holds
  set customer_name = nullif(trim(p_customer_name), ''),
      email = nullif(trim(p_email), ''),
      phone = nullif(trim(p_phone), ''),
      vehicle_plate = nullif(trim(p_vehicle_plate), ''),
      vehicle_make = nullif(trim(p_vehicle_make), ''),
      vehicle_model = nullif(trim(p_vehicle_model), ''),
      vehicle_year = p_vehicle_year
  where id = p_hold_id
    and status = 'active'
    and expires_at > public.tprt_now();

  if not found then
    raise exception 'tprt_hold_not_active';
  end if;
end;
$$;

create or replace function public.create_booking_from_hold(
  p_hold_id uuid,
  p_address text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.booking_holds%rowtype;
  v_booking_id uuid;
  v_lock_key bigint;
begin
  perform public.expire_booking_holds();

  select * into v_hold
  from public.booking_holds
  where id = p_hold_id;

  if v_hold.id is null then
    raise exception 'tprt_hold_not_found';
  end if;
  if v_hold.status = 'converted' then
    select b.id into v_booking_id
    from public.bookings b
    where b.hold_id = v_hold.id
    order by b.created_at desc
    limit 1;
    if v_booking_id is null then
      raise exception 'tprt_hold_converted_missing_booking';
    end if;
    return v_booking_id;
  end if;
  if v_hold.status <> 'active' or v_hold.expires_at <= public.tprt_now() then
    raise exception 'tprt_hold_not_active';
  end if;
  if v_hold.customer_name is null or v_hold.email is null or v_hold.phone is null then
    raise exception 'tprt_hold_missing_customer';
  end if;

  v_lock_key := hashtextextended(
    'slot:' || v_hold.service_id::text || ':' || v_hold.commune_id::text || ':' || v_hold.date::text || ':' || v_hold.time::text,
    0
  );
  perform pg_advisory_xact_lock(v_lock_key);

  insert into public.bookings (
    hold_id, service_id, commune_id, date, time,
    customer_name, email, phone, address, notes,
    vehicle_plate, vehicle_make, vehicle_model, vehicle_year,
    status, user_id
  )
  values (
    v_hold.id, v_hold.service_id, v_hold.commune_id, v_hold.date, v_hold.time,
    v_hold.customer_name, v_hold.email, v_hold.phone, nullif(trim(p_address), ''), nullif(trim(p_notes), ''),
    nullif(trim(v_hold.vehicle_plate), ''), nullif(trim(v_hold.vehicle_make), ''), nullif(trim(v_hold.vehicle_model), ''), v_hold.vehicle_year,
    'pending_payment',
    auth.uid()
  )
  returning id into v_booking_id;

  update public.booking_holds
  set status = 'converted'
  where id = v_hold.id;

  return v_booking_id;
end;
$$;

grant execute on function public.attach_customer_to_hold(uuid, text, citext, text, text, text, text, integer) to anon, authenticated;

-- Notification jobs (server-side processing / cron)
create type public.notification_job_status as enum ('pending', 'processing', 'sent', 'failed');

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind text not null,
  channel text not null default 'email',
  status public.notification_job_status not null default 'pending',
  send_at timestamptz not null default public.tprt_now(),
  attempts integer not null default 0,
  last_error text,
  payload_json jsonb,
  created_at timestamptz not null default public.tprt_now(),
  updated_at timestamptz not null default public.tprt_now(),
  sent_at timestamptz
);

create unique index if not exists notification_jobs_booking_kind_uniq
  on public.notification_jobs (booking_id, kind);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs (status, send_at asc);

-- Minimal updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = public.tprt_now();
  return new;
end;
$$;

drop trigger if exists trg_notification_jobs_updated_at on public.notification_jobs;
create trigger trg_notification_jobs_updated_at
before update on public.notification_jobs
for each row execute function public.set_updated_at();

-- RLS (admin only)
alter table public.notification_jobs enable row level security;

drop policy if exists "notification_jobs_admin_only" on public.notification_jobs;
create policy "notification_jobs_admin_only"
on public.notification_jobs for all
using (public.is_admin())
with check (public.is_admin());

commit;
