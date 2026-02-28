begin;

do $$
declare
  svc_rt uuid;
  svc_gt uuid;
begin
  select id into svc_rt
  from public.services
  where name = 'Revisión técnica inteligente'
  limit 1;

  select id into svc_gt
  from public.services
  where name = 'Gestoría + traslado'
  limit 1;

  insert into public.communes (name, region, active)
  values
    ('La Florida', 'Región Metropolitana', true),
    ('La Reina', 'Región Metropolitana', true),
    ('Lo Barnechea', 'Región Metropolitana', true),
    ('Macul', 'Región Metropolitana', true),
    ('Maipú', 'Región Metropolitana', true),
    ('Peñalolén', 'Región Metropolitana', true),
    ('Pudahuel', 'Región Metropolitana', true),
    ('Vitacura', 'Región Metropolitana', true)
  on conflict do nothing;

  if svc_rt is not null then
    insert into public.service_coverage (service_id, commune_id, active)
    select svc_rt, c.id, true
    from public.communes c
    where c.active = true
    on conflict (service_id, commune_id) do update
      set active = excluded.active;

    insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
    select c.id, svc_rt, d.weekday, '08:30'::time, '18:30'::time, 120, 3
    from public.communes c
    cross join (values (1),(2),(3),(4),(5)) as d(weekday)
    where c.active = true
    on conflict (commune_id, service_id, weekday, start_time, end_time) do update
      set slot_minutes = excluded.slot_minutes,
          capacity = excluded.capacity;

    insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
    select c.id, svc_rt, 6, '08:30'::time, '14:30'::time, 120, 3
    from public.communes c
    where c.active = true
    on conflict (commune_id, service_id, weekday, start_time, end_time) do update
      set slot_minutes = excluded.slot_minutes,
          capacity = excluded.capacity;
  end if;

  if svc_gt is not null then
    insert into public.service_coverage (service_id, commune_id, active)
    select svc_gt, c.id, true
    from public.communes c
    where c.active = true
    on conflict (service_id, commune_id) do update
      set active = excluded.active;

    insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
    select c.id, svc_gt, d.weekday, '08:30'::time, '18:30'::time, 120, 3
    from public.communes c
    cross join (values (1),(2),(3),(4),(5)) as d(weekday)
    where c.active = true
    on conflict (commune_id, service_id, weekday, start_time, end_time) do update
      set slot_minutes = excluded.slot_minutes,
          capacity = excluded.capacity;

    insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
    select c.id, svc_gt, 6, '08:30'::time, '14:30'::time, 120, 3
    from public.communes c
    where c.active = true
    on conflict (commune_id, service_id, weekday, start_time, end_time) do update
      set slot_minutes = excluded.slot_minutes,
          capacity = excluded.capacity;
  end if;
end $$;

commit;
