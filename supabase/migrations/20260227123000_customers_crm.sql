-- TPRT - Customer CRM backbone for commercial actions
-- Adds a normalized customers table, links bookings/payments, and creates a commercial snapshot view.

begin;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email citext not null,
  phone text,
  marketing_opt_in boolean not null default false,
  first_seen_at timestamptz not null default public.tprt_now(),
  last_seen_at timestamptz not null default public.tprt_now(),
  created_at timestamptz not null default public.tprt_now(),
  updated_at timestamptz not null default public.tprt_now(),
  user_id uuid references auth.users(id)
);

create unique index if not exists customers_email_uniq
  on public.customers (email);

create index if not exists customers_phone_idx
  on public.customers (phone);

create index if not exists customers_last_seen_idx
  on public.customers (last_seen_at desc);

alter table public.bookings
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.payments
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists bookings_customer_id_idx
  on public.bookings (customer_id);

create index if not exists payments_customer_id_idx
  on public.payments (customer_id);

create or replace function public.sync_booking_customer_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_name text;
begin
  if new.email is null then
    return new;
  end if;

  v_name := nullif(trim(coalesce(new.customer_name, '')), '');
  if v_name is null then
    v_name := 'Cliente';
  end if;

  insert into public.customers (
    full_name,
    email,
    phone,
    first_seen_at,
    last_seen_at,
    user_id
  )
  values (
    v_name,
    new.email,
    nullif(trim(coalesce(new.phone, '')), ''),
    coalesce(new.created_at, public.tprt_now()),
    public.tprt_now(),
    coalesce(new.user_id, auth.uid())
  )
  on conflict (email) do update
  set full_name = coalesce(nullif(trim(excluded.full_name), ''), public.customers.full_name),
      phone = coalesce(nullif(trim(excluded.phone), ''), public.customers.phone),
      user_id = coalesce(public.customers.user_id, excluded.user_id),
      last_seen_at = public.tprt_now(),
      updated_at = public.tprt_now()
  returning id into v_customer_id;

  new.customer_id := v_customer_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_booking_customer_ref on public.bookings;
create trigger trg_sync_booking_customer_ref
before insert or update of customer_name, email, phone, user_id
on public.bookings
for each row execute function public.sync_booking_customer_ref();

create or replace function public.sync_payment_customer_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null then
    select b.customer_id into new.customer_id
    from public.bookings b
    where b.id = new.booking_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_payment_customer_ref on public.payments;
create trigger trg_sync_payment_customer_ref
before insert or update of booking_id
on public.payments
for each row execute function public.sync_payment_customer_ref();

-- Backfill existing bookings/payments
insert into public.customers (
  full_name,
  email,
  phone,
  first_seen_at,
  last_seen_at,
  user_id
)
select
  coalesce(nullif(trim(coalesce(b.customer_name, '')), ''), 'Cliente') as full_name,
  b.email,
  nullif(trim(coalesce(b.phone, '')), '') as phone,
  coalesce(b.created_at, public.tprt_now()) as first_seen_at,
  public.tprt_now() as last_seen_at,
  b.user_id
from public.bookings b
where b.email is not null
on conflict (email) do update
set full_name = coalesce(nullif(trim(excluded.full_name), ''), public.customers.full_name),
    phone = coalesce(nullif(trim(excluded.phone), ''), public.customers.phone),
    user_id = coalesce(public.customers.user_id, excluded.user_id),
    last_seen_at = public.tprt_now(),
    updated_at = public.tprt_now();

update public.bookings b
set customer_id = c.id
from public.customers c
where b.customer_id is null
  and b.email is not null
  and c.email = b.email;

update public.payments p
set customer_id = b.customer_id
from public.bookings b
where p.customer_id is null
  and p.booking_id = b.id;

create or replace view public.customer_commercial_snapshot as
select
  c.id as customer_id,
  c.full_name,
  c.email,
  c.phone,
  c.marketing_opt_in,
  c.first_seen_at,
  c.last_seen_at,
  coalesce(b_stats.bookings_total, 0) as bookings_total,
  coalesce(b_stats.bookings_confirmed, 0) as bookings_confirmed,
  b_stats.first_booking_at,
  b_stats.last_booking_at,
  b_stats.last_service_date,
  coalesce(p_stats.paid_transactions, 0) as paid_transactions,
  coalesce(p_stats.paid_total_clp, 0)::bigint as paid_total_clp,
  last_vehicle.vehicle_plate as last_vehicle_plate,
  last_vehicle.vehicle_make as last_vehicle_make,
  last_vehicle.vehicle_model as last_vehicle_model,
  last_vehicle.vehicle_year as last_vehicle_year
from public.customers c
left join lateral (
  select
    count(*)::integer as bookings_total,
    count(*) filter (where b.status = 'confirmed')::integer as bookings_confirmed,
    min(b.created_at) as first_booking_at,
    max(b.created_at) as last_booking_at,
    max(b.date) as last_service_date
  from public.bookings b
  where b.customer_id = c.id
) b_stats on true
left join lateral (
  select
    count(*)::integer as paid_transactions,
    coalesce(sum(p.amount_clp), 0)::bigint as paid_total_clp
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  where b.customer_id = c.id
    and p.status = 'paid'
) p_stats on true
left join lateral (
  select
    b.vehicle_plate,
    b.vehicle_make,
    b.vehicle_model,
    b.vehicle_year
  from public.bookings b
  where b.customer_id = c.id
  order by b.created_at desc
  limit 1
) last_vehicle on true;

alter table public.customers enable row level security;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop policy if exists "customers_admin_only" on public.customers;
create policy "customers_admin_only"
on public.customers for all
using (public.is_admin())
with check (public.is_admin());

commit;
