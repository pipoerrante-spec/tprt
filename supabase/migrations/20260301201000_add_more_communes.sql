begin;

do $$
declare
  svc_rt uuid;
begin
  select id into svc_rt
  from public.services
  where name = 'Revisión técnica inteligente'
  limit 1;

  insert into public.communes (name, region, active)
  values
    ('San Miguel', 'Región Metropolitana', true),
    ('Huechuraba', 'Región Metropolitana', true),
    ('Colina', 'Región Metropolitana', true)
  on conflict do nothing;

  if svc_rt is not null then
    insert into public.service_coverage (service_id, commune_id, active)
    select svc_rt, c.id, true
    from public.communes c
    where c.name in ('San Miguel', 'Huechuraba', 'Colina')
    on conflict (service_id, commune_id) do update
      set active = excluded.active;

    insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
    select c.id, svc_rt, d.weekday, '07:30'::time, '17:30'::time, 120, 3
    from public.communes c
    cross join (values (1),(2),(3),(4),(5),(6)) as d(weekday)
    where c.name in ('San Miguel', 'Huechuraba', 'Colina')
    on conflict (commune_id, service_id, weekday, start_time, end_time) do update
      set slot_minutes = excluded.slot_minutes,
          capacity = excluded.capacity;
  end if;
end $$;

commit;
