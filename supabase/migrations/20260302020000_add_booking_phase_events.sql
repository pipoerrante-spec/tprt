begin;

create table if not exists public.booking_phase_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  phase text not null,
  source text not null default 'system',
  payload_json jsonb,
  created_at timestamptz not null default public.tprt_now()
);

create index if not exists booking_phase_events_booking_created_idx
  on public.booking_phase_events (booking_id, created_at desc);

create index if not exists booking_phase_events_phase_created_idx
  on public.booking_phase_events (phase, created_at desc);

alter table public.booking_phase_events enable row level security;

drop policy if exists "booking_phase_events_admin_only" on public.booking_phase_events;
create policy "booking_phase_events_admin_only"
on public.booking_phase_events for all
using (public.is_admin())
with check (public.is_admin());

commit;
