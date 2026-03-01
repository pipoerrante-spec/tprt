begin;

update public.availability_rules
set
  start_time = '07:30'::time,
  end_time = '17:30'::time,
  slot_minutes = 120,
  capacity = 3
where weekday between 1 and 6;

commit;
