-- Migration 021: Security Hardening, Safe Discovery Alias & Search Path Protection
-- Target: jigbzsaaowtyaqhreplg
-- Safe, non-destructive, compatible

-- 1. Create discover_candidates alias forwarding to discover_workers
-- Aligns documentation, client SDK, and database functions with zero PII exposure
create or replace function public.discover_candidates(
  p_city text default null,
  p_category text default null,
  p_experience text default null,
  p_limit integer default 20,
  p_offset integer default 0
) returns table(
  candidate_handle text,
  city text,
  category text,
  experience_band text,
  vehicle_type text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query select * from public.discover_workers(
    p_city,
    p_category,
    p_experience,
    p_limit,
    p_offset
  );
end $$;

revoke all on function public.discover_candidates(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.discover_candidates(text, text, text, integer, integer) to authenticated;

-- 2. Verify and enforce storage access policies on worker-private-documents bucket
-- Ensures workers can only upload to their own user_id directory
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects') then
    -- Authenticated workers can only insert objects in their own subfolder
    drop policy if exists "worker_docs_owner_insert" on storage.objects;
    create policy "worker_docs_owner_insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'worker-private-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    -- Authenticated workers can only select their own objects
    drop policy if exists "worker_docs_owner_select" on storage.objects;
    create policy "worker_docs_owner_select" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'worker-private-documents'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.is_admin()
        )
      );
  end if;
end $$;
