-- TPRT — One-shot Supabase setup (schema + RPC + seed + notifications/vehicle)
-- Run this whole script once in Supabase SQL Editor.

begin;

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Helpers
create or replace function public.tprt_now()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

-- Enums (idempotent)
do $$ begin
  create type public.booking_hold_status as enum ('active', 'expired', 'converted', 'canceled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_status as enum ('pending_payment', 'confirmed', 'canceled', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

-- Core tables
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  base_price integer not null check (base_price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true
);

create table if not exists public.communes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  active boolean not null default true
);

create table if not exists public.service_coverage (
  service_id uuid not null references public.services(id) on delete cascade,
  commune_id uuid not null references public.communes(id) on delete cascade,
  active boolean not null default true,
  primary key (service_id, commune_id)
);

-- Availability rules: define windows by weekday for a given service + commune.
-- weekday uses Postgres extract(dow): 0=Sunday ... 6=Saturday
create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid not null references public.communes(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null check (slot_minutes in (10, 15, 20, 30, 45, 60, 120)),
  capacity integer not null check (capacity >= 1),
  unique (commune_id, service_id, weekday, start_time, end_time)
);

create table if not exists public.booking_holds (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id),
  commune_id uuid not null references public.communes(id),
  date date not null,
  time time not null,
  customer_name text,
  email citext,
  phone text,
  vehicle_plate text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  expires_at timestamptz not null,
  status public.booking_hold_status not null default 'active'
);

create index if not exists booking_holds_lookup_idx
  on public.booking_holds (service_id, commune_id, date, time);
create index if not exists booking_holds_expires_idx
  on public.booking_holds (expires_at) where status = 'active';

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid references public.booking_holds(id),
  service_id uuid not null references public.services(id),
  commune_id uuid not null references public.communes(id),
  date date not null,
  time time not null,
  customer_name text not null,
  email citext not null,
  phone text not null,
  address text not null,
  notes text,
  vehicle_plate text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  status public.booking_status not null default 'pending_payment',
  created_at timestamptz not null default public.tprt_now(),
  user_id uuid references auth.users(id)
);

create index if not exists bookings_lookup_idx
  on public.bookings (service_id, commune_id, date, time);
create index if not exists bookings_customer_email_idx
  on public.bookings (email);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider text not null,
  amount_clp integer not null check (amount_clp > 0),
  currency text not null default 'CLP',
  status public.payment_status not null default 'pending',
  external_ref text,
  created_at timestamptz not null default public.tprt_now(),
  user_id uuid references auth.users(id)
);

create index if not exists payments_booking_idx
  on public.payments (booking_id);
create index if not exists payments_provider_ref_idx
  on public.payments (provider, external_ref);

create table if not exists public.webhooks_log (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  payload_json jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default public.tprt_now()
);

create index if not exists webhooks_log_provider_idx
  on public.webhooks_log (provider, created_at desc);

-- RLS
alter table public.services enable row level security;
alter table public.communes enable row level security;
alter table public.service_coverage enable row level security;
alter table public.availability_rules enable row level security;
alter table public.booking_holds enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.webhooks_log enable row level security;

-- Public read of catalog
drop policy if exists "services_read_public" on public.services;
create policy "services_read_public"
on public.services for select
using (active = true);

drop policy if exists "communes_read_public" on public.communes;
create policy "communes_read_public"
on public.communes for select
using (active = true);

drop policy if exists "coverage_read_public" on public.service_coverage;
create policy "coverage_read_public"
on public.service_coverage for select
using (active = true);

drop policy if exists "availability_rules_read_public" on public.availability_rules;
create policy "availability_rules_read_public"
on public.availability_rules for select
using (true);

-- Holds are accessed via RPC to prevent PII leakage; keep table locked down.
drop policy if exists "booking_holds_none" on public.booking_holds;
create policy "booking_holds_none"
on public.booking_holds for all
using (false)
with check (false);

-- Bookings/payments only admin or owner when Auth is used.
-- Admin is represented by app_metadata.is_admin = true.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

drop policy if exists "bookings_owner_read" on public.bookings;
create policy "bookings_owner_read"
on public.bookings for select
using (public.is_admin() or (auth.uid() is not null and user_id = auth.uid()));

drop policy if exists "bookings_owner_write" on public.bookings;
create policy "bookings_owner_write"
on public.bookings for insert
with check (public.is_admin() or (auth.uid() is not null and user_id = auth.uid()));

drop policy if exists "bookings_owner_update" on public.bookings;
create policy "bookings_owner_update"
on public.bookings for update
using (public.is_admin() or (auth.uid() is not null and user_id = auth.uid()))
with check (public.is_admin() or (auth.uid() is not null and user_id = auth.uid()));

drop policy if exists "payments_owner_read" on public.payments;
create policy "payments_owner_read"
on public.payments for select
using (public.is_admin() or (auth.uid() is not null and user_id = auth.uid()));

drop policy if exists "payments_owner_write" on public.payments;
create policy "payments_owner_write"
on public.payments for insert
with check (public.is_admin() or (auth.uid() is not null and user_id = auth.uid()));

drop policy if exists "payments_owner_update" on public.payments;
create policy "payments_owner_update"
on public.payments for update
using (public.is_admin() or (auth.uid() is not null and user_id = auth.uid()))
with check (public.is_admin() or (auth.uid() is not null and user_id = auth.uid()));

-- Webhook logs: admin only.
drop policy if exists "webhooks_admin_only" on public.webhooks_log;
create policy "webhooks_admin_only"
on public.webhooks_log for all
using (public.is_admin())
with check (public.is_admin());

-- RPC + capacity enforcement (holds + availability + payments)

-- Expire holds (idempotent)
create or replace function public.expire_booking_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.booking_holds
  set status = 'expired'
  where status = 'active' and expires_at <= public.tprt_now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Compute slot capacity for a given service/commune/date/time. Returns 0 if not schedulable.
create or replace function public.slot_capacity(
  p_service_id uuid,
  p_commune_id uuid,
  p_date date,
  p_time time
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weekday smallint := extract(dow from p_date)::smallint;
  v_cap integer;
  v_slot_minutes integer;
  v_start time;
begin
  select ar.capacity, ar.slot_minutes, ar.start_time
  into v_cap, v_slot_minutes, v_start
  from public.availability_rules ar
  where ar.service_id = p_service_id
    and ar.commune_id = p_commune_id
    and ar.weekday = v_weekday
    and p_time >= ar.start_time
    and p_time < ar.end_time
  order by ar.start_time asc
  limit 1;

  if v_cap is null then
    return 0;
  end if;

  -- alignment check: time must be on the grid from rule.start_time by slot_minutes
  if mod(((extract(epoch from (p_time - v_start)) / 60)::int), v_slot_minutes) <> 0 then
    return 0;
  end if;

  return v_cap;
end;
$$;

-- Trigger-level enforcement to prevent overbooking even if inserts bypass RPC.
create or replace function public.enforce_slot_capacity_on_holds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
  v_reserved integer;
  v_lock_key bigint;
begin
  if (tg_op = 'DELETE') then
    return old;
  end if;

  if new.status <> 'active' then
    return new;
  end if;

  if new.expires_at <= public.tprt_now() then
    new.status := 'expired';
    return new;
  end if;

  v_lock_key := hashtextextended(
    'slot:' || new.service_id::text || ':' || new.commune_id::text || ':' || new.date::text || ':' || new.time::text,
    0
  );
  perform pg_advisory_xact_lock(v_lock_key);

  v_cap := public.slot_capacity(new.service_id, new.commune_id, new.date, new.time);
  if v_cap <= 0 then
    raise exception 'tprt_slot_not_available';
  end if;

  select
    (select count(*) from public.bookings b
      where b.service_id = new.service_id and b.commune_id = new.commune_id and b.date = new.date and b.time = new.time
        and b.status in ('pending_payment','confirmed')) +
    (select count(*) from public.booking_holds h
      where h.service_id = new.service_id and h.commune_id = new.commune_id and h.date = new.date and h.time = new.time
        and h.status = 'active' and h.expires_at > public.tprt_now()
        and h.id <> coalesce(new.id, gen_random_uuid()))
  into v_reserved;

  if v_reserved >= v_cap then
    raise exception 'tprt_slot_full';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_slot_capacity_holds on public.booking_holds;
create trigger trg_enforce_slot_capacity_holds
before insert or update on public.booking_holds
for each row execute function public.enforce_slot_capacity_on_holds();

create or replace function public.enforce_slot_capacity_on_bookings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
  v_reserved integer;
  v_lock_key bigint;
begin
  if (tg_op = 'DELETE') then
    return old;
  end if;

  if new.status not in ('pending_payment','confirmed') then
    return new;
  end if;

  v_lock_key := hashtextextended(
    'slot:' || new.service_id::text || ':' || new.commune_id::text || ':' || new.date::text || ':' || new.time::text,
    0
  );
  perform pg_advisory_xact_lock(v_lock_key);

  v_cap := public.slot_capacity(new.service_id, new.commune_id, new.date, new.time);
  if v_cap <= 0 then
    raise exception 'tprt_slot_not_available';
  end if;

  select
    (select count(*) from public.bookings b
      where b.service_id = new.service_id and b.commune_id = new.commune_id and b.date = new.date and b.time = new.time
        and b.status in ('pending_payment','confirmed')
        and b.id <> coalesce(new.id, gen_random_uuid())) +
    (select count(*) from public.booking_holds h
      where h.service_id = new.service_id and h.commune_id = new.commune_id and h.date = new.date and h.time = new.time
        and h.status = 'active' and h.expires_at > public.tprt_now())
  into v_reserved;

  if v_reserved >= v_cap then
    raise exception 'tprt_slot_full';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_slot_capacity_bookings on public.bookings;
create trigger trg_enforce_slot_capacity_bookings
before insert or update on public.bookings
for each row execute function public.enforce_slot_capacity_on_bookings();

-- Public catalog RPC (optional; RLS already allows select)
create or replace function public.get_communes_for_service(p_service_id uuid)
returns table (id uuid, name text, region text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, c.region
  from public.communes c
  join public.service_coverage sc on sc.commune_id = c.id
  where sc.service_id = p_service_id
    and sc.active = true
    and c.active = true
  order by c.region, c.name;
$$;

-- Availability for a date range: returns each slot with remaining capacity.
create or replace function public.get_availability_slots(
  p_service_id uuid,
  p_commune_id uuid,
  p_date_from date,
  p_date_to date
)
returns table (
  "date" date,
  "time" time,
  capacity integer,
  reserved integer,
  remaining integer,
  demand text,
  available boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_booking_holds();

  return query
  with dates as (
    select d::date as date, extract(dow from d)::smallint as weekday
    from generate_series(p_date_from::timestamptz, p_date_to::timestamptz, interval '1 day') d
  ),
  rules as (
    select ar.*
    from public.availability_rules ar
    where ar.service_id = p_service_id
      and ar.commune_id = p_commune_id
  ),
  slots as (
    select
      dd.date,
      gs::time as time,
      r.capacity as capacity
    from dates dd
    join rules r on r.weekday = dd.weekday
    cross join lateral generate_series(
      (dd.date::timestamp + r.start_time)::timestamp,
      (dd.date::timestamp + r.end_time - make_interval(mins => r.slot_minutes))::timestamp,
      make_interval(mins => r.slot_minutes)
    ) gs
  ),
  reserved_bookings as (
    select b.date, b.time, count(*)::int as cnt
    from public.bookings b
    where b.service_id = p_service_id
      and b.commune_id = p_commune_id
      and b.status in ('pending_payment','confirmed')
      and b.date between p_date_from and p_date_to
    group by b.date, b.time
  ),
  reserved_holds as (
    select h.date, h.time, count(*)::int as cnt
    from public.booking_holds h
    where h.service_id = p_service_id
      and h.commune_id = p_commune_id
      and h.status = 'active'
      and h.expires_at > public.tprt_now()
      and h.date between p_date_from and p_date_to
    group by h.date, h.time
  )
  select
    s.date,
    s.time,
    s.capacity,
    (coalesce(rb.cnt, 0) + coalesce(rh.cnt, 0))::int as reserved,
    greatest(s.capacity - (coalesce(rb.cnt, 0) + coalesce(rh.cnt, 0)), 0)::int as remaining,
    case
      when s.capacity - (coalesce(rb.cnt, 0) + coalesce(rh.cnt, 0)) <= 0 then 'sold_out'
      when s.capacity <= 2 and s.capacity - (coalesce(rb.cnt, 0) + coalesce(rh.cnt, 0)) = 1 then 'high'
      when (s.capacity - (coalesce(rb.cnt, 0) + coalesce(rh.cnt, 0)))::numeric / s.capacity <= 0.25 then 'high'
      when (s.capacity - (coalesce(rb.cnt, 0) + coalesce(rh.cnt, 0)))::numeric / s.capacity <= 0.5 then 'medium'
      else 'low'
    end as demand,
    (s.capacity - (coalesce(rb.cnt, 0) + coalesce(rh.cnt, 0)) > 0) as available
  from slots s
  left join reserved_bookings rb on rb.date = s.date and rb.time = s.time
  left join reserved_holds rh on rh.date = s.date and rh.time = s.time
  order by s.date, s.time;
end;
$$;

-- Create a hold with TTL, enforcing coverage + capacity.
create or replace function public.create_booking_hold(
  p_service_id uuid,
  p_commune_id uuid,
  p_date date,
  p_time time,
  p_ttl_minutes integer default 7
)
returns table (hold_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ttl integer := greatest(1, least(coalesce(p_ttl_minutes, 7), 15));
  v_expires_at timestamptz := public.tprt_now() + make_interval(mins => v_ttl);
  v_lock_key bigint;
begin
  perform public.expire_booking_holds();

  if not exists (
    select 1
    from public.service_coverage sc
    join public.services s on s.id = sc.service_id
    join public.communes c on c.id = sc.commune_id
    where sc.service_id = p_service_id
      and sc.commune_id = p_commune_id
      and sc.active = true
      and s.active = true
      and c.active = true
  ) then
    raise exception 'tprt_not_in_coverage';
  end if;

  v_lock_key := hashtextextended(
    'slot:' || p_service_id::text || ':' || p_commune_id::text || ':' || p_date::text || ':' || p_time::text,
    0
  );
  perform pg_advisory_xact_lock(v_lock_key);

  insert into public.booking_holds (service_id, commune_id, date, time, expires_at, status)
  values (p_service_id, p_commune_id, p_date, p_time, v_expires_at, 'active')
  returning id, booking_holds.expires_at into hold_id, expires_at;

  return next;
end;
$$;

-- Public-safe hold view by id (no PII).
create or replace function public.get_booking_hold_public(p_hold_id uuid)
returns table (
  id uuid,
  service_id uuid,
  commune_id uuid,
  "date" date,
  "time" time,
  expires_at timestamptz,
  status public.booking_hold_status
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_booking_holds();

  update public.booking_holds
  set status = 'expired'
  where id = p_hold_id and status = 'active' and expires_at <= public.tprt_now();

  return query
  select h.id, h.service_id, h.commune_id, h.date, h.time, h.expires_at, h.status
  from public.booking_holds h
  where h.id = p_hold_id;
end;
$$;

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

-- Convert hold into a booking (pending payment).
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

-- Payments: create payment record for a booking.
create or replace function public.create_payment_for_booking(
  p_booking_id uuid,
  p_provider text,
  p_amount_clp integer,
  p_external_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
begin
  insert into public.payments (booking_id, provider, amount_clp, currency, status, external_ref, user_id)
  values (p_booking_id, p_provider, p_amount_clp, 'CLP', 'pending', p_external_ref, auth.uid())
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- Mark payment status; when paid, booking becomes confirmed.
create or replace function public.set_payment_status(
  p_payment_id uuid,
  p_status public.payment_status,
  p_external_ref text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_lock_key bigint;
begin
  select booking_id into v_booking_id
  from public.payments
  where id = p_payment_id;

  if v_booking_id is null then
    raise exception 'tprt_payment_not_found';
  end if;

  v_lock_key := hashtextextended('booking:' || v_booking_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  update public.payments
  set status = p_status,
      external_ref = coalesce(nullif(trim(p_external_ref), ''), external_ref)
  where id = p_payment_id;

  if p_status = 'paid' then
    update public.bookings
    set status = 'confirmed'
    where id = v_booking_id;
  elsif p_status = 'failed' then
    update public.bookings
    set status = 'canceled'
    where id = v_booking_id and status = 'pending_payment';
  end if;
end;
$$;

-- Grants for anon/authenticated
grant execute on function public.expire_booking_holds() to anon, authenticated;
grant execute on function public.get_communes_for_service(uuid) to anon, authenticated;
grant execute on function public.get_availability_slots(uuid, uuid, date, date) to anon, authenticated;
grant execute on function public.create_booking_hold(uuid, uuid, date, time, integer) to anon, authenticated;
grant execute on function public.get_booking_hold_public(uuid) to anon, authenticated;
grant execute on function public.attach_customer_to_hold(uuid, text, citext, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.create_booking_from_hold(uuid, text, text) to anon, authenticated;
grant execute on function public.create_payment_for_booking(uuid, text, integer, text) to anon, authenticated;
grant execute on function public.set_payment_status(uuid, public.payment_status, text) to anon, authenticated;

-- Seed minimal catalog + default availability
do $$
declare
  svc_rt uuid;
  c_santiago uuid;
  c_provi uuid;
  c_nunoa uuid;
  c_lascondes uuid;
  c_puentealto uuid;
begin
  insert into public.services (name, description, base_price, duration_minutes, active)
  values
    ('Revisión técnica inteligente', 'Gestión completa para pasar la revisión técnica sin perder 3–5 horas: agenda, coordinación y seguimiento.', 85000, 60, true)
  on conflict do nothing;

  update public.services
  set base_price = 85000
  where name = 'Revisión técnica inteligente';

  update public.services
  set active = false
  where name = 'Gestoría + traslado';

  select id into svc_rt from public.services where name = 'Revisión técnica inteligente' limit 1;

  insert into public.communes (name, region, active)
  values
    ('Santiago', 'Región Metropolitana', true),
    ('Providencia', 'Región Metropolitana', true),
    ('Ñuñoa', 'Región Metropolitana', true),
    ('Las Condes', 'Región Metropolitana', true),
    ('Puente Alto', 'Región Metropolitana', true)
  on conflict do nothing;

  select id into c_santiago from public.communes where name = 'Santiago' limit 1;
  select id into c_provi from public.communes where name = 'Providencia' limit 1;
  select id into c_nunoa from public.communes where name = 'Ñuñoa' limit 1;
  select id into c_lascondes from public.communes where name = 'Las Condes' limit 1;
  select id into c_puentealto from public.communes where name = 'Puente Alto' limit 1;

  insert into public.service_coverage (service_id, commune_id, active)
  values
    (svc_rt, c_santiago, true),
    (svc_rt, c_provi, true),
    (svc_rt, c_nunoa, true),
    (svc_rt, c_lascondes, true),
    (svc_rt, c_puentealto, true)
  on conflict do nothing;

  -- Weekdays: 08:30-18:30 every 2 hours, capacity 3 for the core service.
  insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
  select c.id, svc_rt, d.weekday, '08:30'::time, '18:30'::time, 120, 3
  from (values (1),(2),(3),(4),(5)) as d(weekday)
  cross join (values (c_santiago),(c_provi),(c_nunoa),(c_lascondes),(c_puentealto)) as c(id)
  on conflict do nothing;

  -- Saturdays: 08:30-14:30 every 2 hours, capacity 3.
  insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
  select c.id, svc_rt, 6, '08:30'::time, '14:30'::time, 120, 3
  from (values (c_santiago),(c_provi),(c_nunoa),(c_lascondes),(c_puentealto)) as c(id)
  on conflict do nothing;

end $$;

-- Notification jobs (server-side processing / cron)
do $$ begin
  create type public.notification_job_status as enum ('pending', 'processing', 'sent', 'failed');
exception when duplicate_object then null;
end $$;

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
