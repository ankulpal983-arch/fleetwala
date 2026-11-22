-- UNEXECUTED — Migration 7 of 15. Prerequisite: 003; Supabase Storage available.
-- Bucket remains private. Object keys must be <auth.uid>/<random filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-private-documents', 'worker-private-documents', false, 10485760,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create table public.worker_documents (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  storage_path text not null unique,
  document_kind public.document_kind not null,
  original_filename text not null check (char_length(original_filename) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now()
);
-- Metadata contains no document contents, addresses, or publicly usable URLs.
