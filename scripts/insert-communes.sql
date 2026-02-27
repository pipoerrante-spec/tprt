INSERT INTO public.communes (name, region, active)
SELECT * FROM (VALUES
  ('Vitacura', 'Región Metropolitana', true),
  ('Lo Barnechea', 'Región Metropolitana', true),
  ('La Reina', 'Región Metropolitana', true),
  ('Peñalolén', 'Región Metropolitana', true),
  ('Macul', 'Región Metropolitana', true),
  ('La Florida', 'Región Metropolitana', true),
  ('Pudahuel', 'Región Metropolitana', true),
  ('Maipú', 'Región Metropolitana', true)
) AS new_comunas(name, region, active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.communes c WHERE c.name = new_comunas.name
);
