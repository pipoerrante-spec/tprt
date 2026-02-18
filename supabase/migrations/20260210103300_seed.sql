-- TPRT - Seed minimal catalog + default availability

begin;

do $$
declare
  svc_rt uuid;
  svc_gest uuid;
  c_santiago uuid;
  c_provi uuid;
  c_nunoa uuid;
  c_lascondes uuid;
  c_puentealto uuid;
begin
  insert into public.services (name, description, base_price, duration_minutes, active)
  values
    ('Revisión técnica inteligente', 'Gestión completa para pasar la revisión técnica sin perder 3–5 horas: agenda, coordinación y seguimiento.', 34990, 60, true),
    ('Gestoría + traslado', 'Vamos por tu vehículo y lo devolvemos (según comuna). Incluye coordinación y recordatorios.', 49990, 90, true)
  returning id into svc_rt;

  -- If the insert above inserted 2 rows, svc_rt is last; fetch explicitly.
  select id into svc_rt from public.services where name = 'Revisión técnica inteligente' limit 1;
  select id into svc_gest from public.services where name = 'Gestoría + traslado' limit 1;

  insert into public.communes (name, region, active)
  values
    ('Santiago', 'Región Metropolitana', true),
    ('Providencia', 'Región Metropolitana', true),
    ('Ñuñoa', 'Región Metropolitana', true),
    ('Las Condes', 'Región Metropolitana', true),
    ('Puente Alto', 'Región Metropolitana', true);

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
    (svc_rt, c_puentealto, true),
    (svc_gest, c_santiago, true),
    (svc_gest, c_provi, true),
    (svc_gest, c_nunoa, true),
    (svc_gest, c_lascondes, true),
    (svc_gest, c_puentealto, true)
  on conflict do nothing;

  -- Weekdays: 09:00-18:00 every 30 min, capacity 2 for the core service.
  insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
  select c.id, svc_rt, d.weekday, '09:00'::time, '18:00'::time, 30, 2
  from (values (1),(2),(3),(4),(5)) as d(weekday)
  cross join (values (c_santiago),(c_provi),(c_nunoa),(c_lascondes),(c_puentealto)) as c(id)
  on conflict do nothing;

  -- Saturdays: 10:00-14:00, capacity 1.
  insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
  select c.id, svc_rt, 6, '10:00'::time, '14:00'::time, 30, 1
  from (values (c_santiago),(c_provi),(c_nunoa),(c_lascondes),(c_puentealto)) as c(id)
  on conflict do nothing;

  -- Gestoría + traslado: fewer slots, capacity 1.
  insert into public.availability_rules (commune_id, service_id, weekday, start_time, end_time, slot_minutes, capacity)
  select c.id, svc_gest, d.weekday, '10:00'::time, '17:00'::time, 60, 1
  from (values (1),(2),(3),(4),(5)) as d(weekday)
  cross join (values (c_santiago),(c_provi),(c_nunoa),(c_lascondes),(c_puentealto)) as c(id)
  on conflict do nothing;
end $$;

commit;

