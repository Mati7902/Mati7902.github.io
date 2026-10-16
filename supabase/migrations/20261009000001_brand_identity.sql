-- =============================================================================
-- Identidad visual del Lic. Matías Sánchez: paleta petróleo + verde menta,
-- título del inicio y áreas de trabajo.
-- Solo reemplaza valores que siguen siendo los predeterminados anteriores: lo que
-- ya se personalizó desde Administración › Configuración no se toca.
-- =============================================================================

update public.settings
set value = jsonb_build_object('primary', '#2f6468', 'accent', '#27b088', 'background', '#fbfdfc'),
    updated_at = now()
where key = 'theme'
  and lower(value->>'primary') = '#1f4e5f'
  and lower(value->>'accent') = '#a8dccb'
  and lower(value->>'background') = '#faf8f5';

-- Áreas de trabajo y enfoque diferencial: se agregan solo si todavía no existen
-- (en "nuevo || actual" ganan las claves que ya estaban guardadas).
update public.settings
set value = jsonb_build_object(
      'specialties_title', 'Terapia basada en neurociencia aplicada',
      'specialties', jsonb_build_array(
        jsonb_build_object('title', 'Trastornos de ansiedad', 'text', 'Ansiedad generalizada, pánico, fobias y ansiedad social.'),
        jsonb_build_object('title', 'Depresión', 'text', 'Depresión mayor, distimia y episodios del estado de ánimo.'),
        jsonb_build_object('title', 'Estrés y burnout', 'text', 'Estrés crónico, agotamiento laboral e insomnio.'),
        jsonb_build_object('title', 'Trauma y duelo', 'text', 'Estrés postraumático, duelos y procesos de cambio vital.')
      ),
      'approach_label', 'Enfoque diferencial',
      'approach_text', 'Integración de psicoterapia clínica y neurociencia aplicada, con intervenciones respaldadas por evidencia actualizada.'
    ) || value,
    updated_at = now()
where key = 'landing'
  and not (value ? 'specialties');

-- Título y bajada nuevos, solo si seguían los textos originales de la plataforma.
-- Las palabras entre asteriscos se destacan en cursiva y en el color de acento.
update public.settings
set value = value || jsonb_build_object(
      'hero_title', 'Terapia desde *donde estés*, con el rigor de una consulta clínica.',
      'hero_subtitle', 'Acompañamiento psicológico profesional en modalidad virtual, con el mismo marco clínico, ético y basado en evidencia que en consultorio.'
    ),
    updated_at = now()
where key = 'landing'
  and value->>'hero_title' = 'Un espacio para comprender lo que te pasa y trabajar en lo que necesitás.'
  and value->>'hero_subtitle' = 'Acompañamiento psicológico para adolescentes y adultos, de manera presencial o virtual.';
