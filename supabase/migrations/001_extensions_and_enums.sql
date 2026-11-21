-- UNEXECUTED — Migration 1 of 15. Apply once, in order, to an approved project.
-- Prerequisite: Supabase project with auth schema. Effect: shared enums/extensions.
create extension if not exists pgcrypto with schema extensions;

create type public.account_state as enum ('active', 'suspended', 'deleted');
create type public.employer_type as enum ('company', 'vendor_dsp', 'recruitment_agency');
create type public.membership_role as enum ('owner', 'manager', 'recruiter');
create type public.membership_state as enum ('invited', 'active', 'suspended', 'removed');
create type public.job_state as enum ('draft', 'pending_review', 'published', 'rejected', 'paused', 'closed');
create type public.application_state as enum ('applied', 'reviewing', 'shortlisted', 'rejected', 'hired', 'withdrawn');
create type public.document_kind as enum ('driving_licence', 'identity_document', 'other');
create type public.payment_state as enum ('created', 'pending', 'succeeded', 'failed', 'refunded');
create type public.ticket_state as enum ('open', 'in_progress', 'resolved', 'closed');
