-- ============================================================================
-- 0005 · Storage: buckets y políticas
--   materials → privado (PDF, audio, video, imágenes). Acceso por URL firmada.
--   avatars   → público (fotos de perfil, carpeta por usuario).
--   branding  → público (foto profesional, logo) administrado por el admin.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('materials', 'materials', false, 52428800, array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm'
  ]),
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('branding', 'branding', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- materials: admin gestiona; el paciente solo lee objetos de materiales a los que tiene acceso.
create policy "materials: admin gestiona objetos" on storage.objects for all to authenticated
  using (bucket_id = 'materials' and public.is_admin())
  with check (bucket_id = 'materials' and public.is_admin());

create policy "materials: paciente lee accesibles" on storage.objects for select to authenticated
  using (
    bucket_id = 'materials'
    and exists (
      select 1 from public.materials m
      where m.storage_path = storage.objects.name
        and m.is_published
        and (
          m.visibility = 'public'
          or exists (
            select 1 from public.patient_materials pm
            where pm.material_id = m.id and pm.patient_id = public.current_patient_id() and pm.assigned_by is not null
          )
        )
    )
  );

-- avatars: lectura pública; cada usuario escribe solo en su carpeta.
create policy "avatars: lectura pública" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars: subir propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: actualizar propio" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: borrar propio" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- branding: lectura pública; escritura solo admin.
create policy "branding: lectura pública" on storage.objects for select to anon, authenticated using (bucket_id = 'branding');
create policy "branding: admin gestiona" on storage.objects for all to authenticated
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());
