-- TPRT - RPC + capacity enforcement (holds + availability + payments)

begin;

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
  date date,
  time time,
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
  date date,
  time time,
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
  p_vehicle_plate text default null
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
      vehicle_plate = nullif(trim(p_vehicle_plate), '')
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
    customer_name, email, phone, address, notes, status, user_id
  )
  values (
    v_hold.id, v_hold.service_id, v_hold.commune_id, v_hold.date, v_hold.time,
    v_hold.customer_name, v_hold.email, v_hold.phone, nullif(trim(p_address), ''), nullif(trim(p_notes), ''),
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
grant execute on function public.attach_customer_to_hold(uuid, text, citext, text, text) to anon, authenticated;
grant execute on function public.create_booking_from_hold(uuid, text, text) to anon, authenticated;
grant execute on function public.create_payment_for_booking(uuid, text, integer, text) to anon, authenticated;
grant execute on function public.set_payment_status(uuid, public.payment_status, text) to anon, authenticated;

commit;
