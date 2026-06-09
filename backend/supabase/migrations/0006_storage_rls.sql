-- ============================================================================
-- Module 6: Storage RLS
-- Bucket policies for tenant file isolation
-- ============================================================================

-- Storage RLS (tenant file isolation on excel-files bucket)
drop policy if exists "tenant_files_select" on storage.objects;
create policy "tenant_files_select"
on storage.objects for select
using (
  bucket_id = 'excel-files'
  and (storage.foldername(name))[1] in (
    select tenant_id::text from public.memberships
    where user_id = auth.uid()
  )
);

drop policy if exists "tenant_files_insert" on storage.objects;
create policy "tenant_files_insert"
on storage.objects for insert
with check (
  bucket_id = 'excel-files'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] in (
    select tenant_id::text from public.memberships
    where user_id = auth.uid()
  )
);

drop policy if exists "tenant_files_delete" on storage.objects;
create policy "tenant_files_delete"
on storage.objects for delete
using (
  bucket_id = 'excel-files'
  and (storage.foldername(name))[1] in (
    select tenant_id::text from public.memberships
    where user_id = auth.uid()
  )
);
