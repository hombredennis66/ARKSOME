-- ARKSOME content media storage.
-- The bucket is public for published cover images/video posters; uploads are
-- still restricted to authenticated users writing into their own user folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media',
  'content-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "content media is publicly readable" on storage.objects;
create policy "content media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'content-media');

drop policy if exists "members upload own content media" on storage.objects;
create policy "members upload own content media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "members update own content media" on storage.objects;
create policy "members update own content media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'content-media'
    and owner_id = auth.uid()::text
  )
  with check (
    bucket_id = 'content-media'
    and owner_id = auth.uid()::text
  );

drop policy if exists "members delete own content media" on storage.objects;
create policy "members delete own content media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'content-media'
    and owner_id = auth.uid()::text
  );
