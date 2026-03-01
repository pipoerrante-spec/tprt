alter table public.availability_rules
  drop constraint if exists availability_rules_slot_minutes_check;

alter table public.availability_rules
  add constraint availability_rules_slot_minutes_check
  check (slot_minutes in (10, 15, 20, 30, 45, 60, 120));

update public.availability_rules
set
  start_time = '07:30'::time,
  end_time = '17:30'::time,
  slot_minutes = 120,
  capacity = 3
where weekday in (1, 2, 3, 4, 5, 6);
