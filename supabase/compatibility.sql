-- À utiliser seulement si une table/colonne manque.
-- Ne supprime aucune donnée.
create extension if not exists pgcrypto;

create table if not exists public.person_relations (
  id uuid primary key default gen_random_uuid(),
  person_a_id uuid not null references public.identities(id) on delete cascade,
  person_b_id uuid not null references public.identities(id) on delete cascade,
  relation_type text not null default 'ASSOCIÉ',
  notes text,
  created_at timestamptz not null default now(),
  check (person_a_id <> person_b_id)
);

create index if not exists person_relations_a_idx on public.person_relations(person_a_id);
create index if not exists person_relations_b_idx on public.person_relations(person_b_id);

alter table public.person_relations enable row level security;
drop policy if exists "cid_public_all" on public.person_relations;
create policy "cid_public_all" on public.person_relations for all to anon, authenticated using (true) with check (true);

-- Colonnes utilisées par le frontend lorsqu'elles n'existent pas encore.
alter table public.reports add column if not exists product text;
alter table public.reports add column if not exists suspect_id uuid;
alter table public.reports add column if not exists phone text;
alter table public.reports add column if not exists linked_traffic boolean not null default false;
alter table public.reports add column if not exists linked_report_id uuid;


-- Individus libres dans les rapports : ils n'ont pas besoin d'exister dans identities.
alter table public.report_people add column if not exists person_name text;
alter table public.report_people add column if not exists person_phone text;

alter table public.report_people alter column identity_id drop not null;
