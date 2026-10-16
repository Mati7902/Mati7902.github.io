-- =============================================================================
-- Público y colección de cada ejercicio.
-- audience: a quién se le ofrece en la lista del paciente (los asignados se ven siempre).
--   todos · adolescentes (13 a 18 años) · adultos
-- collection: cuadernillo al que pertenece, para mostrarlo como un recorrido en orden
--   ('brujula' = cuadernillo para adolescentes, 'tcc' = Cuadernillo de TCC).
-- =============================================================================

alter table public.exercise_templates
  add column audience text not null default 'todos',
  add column collection text;

alter table public.exercise_templates
  add constraint exercise_templates_audience_check check (audience in ('todos', 'adolescentes', 'adultos'));

create index exercise_templates_collection_idx on public.exercise_templates (collection, sort_order);

comment on column public.exercise_templates.audience is 'todos | adolescentes | adultos. Filtra la lista del paciente según su edad; lo asignado se ve siempre.';
comment on column public.exercise_templates.collection is 'Cuadernillo al que pertenece (brujula, tcc); null = ejercicio suelto.';
