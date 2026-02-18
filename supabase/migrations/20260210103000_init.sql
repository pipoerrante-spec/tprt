-- TPRT - Initial schema (Chile booking + holds + payments)
-- This migration is designed for Supabase Postgres.

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
  slot_minutes integer not null check (slot_minutes in (10, 15, 20, 30, 45, 60)),
  capacity integer not null check (capacity >= 1),
  unique (commune_id, service_id, weekday, start_time, end_time)
);

create type public.booking_hold_status as enum ('active', 'expired', 'converted', 'canceled');
create type public.booking_status as enum ('pending_payment', 'confirmed', 'canceled', 'completed');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

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
  status public.booking_status not null default 'pending_payment',
  created_at timestamptz not null default public.tprt_now(),
  user_id uuid references auth.users(id)
);

create index if not exists bookings_lookup_idx
  on public.bookings (service_id, commune_id, date, time);
create index if not exists bookings_customer_email_idx
  on public.bookings (email);

-- Slot capacity is enforced via RPC/trigger logic (capacity can be > 1).

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

commit;
