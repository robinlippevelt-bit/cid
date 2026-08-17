-- CID RP - schéma complet rapports / preuves / relations
create extension if not exists pgcrypto;

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'ORGANISATION',
  icon text default '◈',
  description text,
  created_at timestamptz not null default now()
);

create table if not exists identities (
  id uuid primary key default gen_random_uuid(),
  last_name text not null,
  first_name text not null,
  birth_date date,
  phone text,
  role text,
  group_id uuid references groups(id) on delete set null,
  involvement text default 'Moyen',
  status text default 'Inconnu',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null,
  plate text not null unique,
  color text,
  owner_id uuid references identities(id) on delete set null,
  group_id uuid references groups(id) on delete set null,
  stolen boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists intelligence_notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete set null,
  identity_id uuid references identities(id) on delete set null,
  content text not null,
  agent text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  detail text,
  agent text,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('TRAFIC','RECOLTE','LABORATOIRE')),
  product text,
  title text,
  suspect_id uuid references identities(id) on delete set null,
  group_id uuid references groups(id) on delete set null,
  quantity text,
  phone text,
  content text,
  linked_traffic boolean not null default false,
  linked_report_id uuid references reports(id) on delete set null,
  agent text,
  created_at timestamptz not null default now()
);

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  url text not null,
  caption text,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists report_people (
  report_id uuid not null references reports(id) on delete cascade,
  identity_id uuid not null references identities(id) on delete cascade,
  relation_type text default 'LIÉ',
  primary key (report_id, identity_id)
);

create table if not exists report_vehicles (
  report_id uuid not null references reports(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  relation_type text default 'LIÉ',
  primary key (report_id, vehicle_id)
);

create table if not exists person_relations (
  id uuid primary key default gen_random_uuid(),
  person_a_id uuid not null references identities(id) on delete cascade,
  person_b_id uuid not null references identities(id) on delete cascade,
  relation_type text not null default 'ASSOCIÉ',
  notes text,
  created_at timestamptz not null default now(),
  constraint person_relations_not_self check (person_a_id <> person_b_id)
);

create index if not exists reports_group_idx on reports(group_id);
create index if not exists reports_suspect_idx on reports(suspect_id);
create index if not exists reports_type_idx on reports(report_type);
create index if not exists evidence_report_idx on evidence(report_id);
create index if not exists report_people_identity_idx on report_people(identity_id);
create index if not exists report_vehicles_vehicle_idx on report_vehicles(vehicle_id);
create index if not exists person_relations_a_idx on person_relations(person_a_id);
create index if not exists person_relations_b_idx on person_relations(person_b_id);

-- Groupes de base : garde les noms existants si tu en as déjà.
insert into groups (name, category, icon) values
('Diamond City','ORGANISATION','💎'),
('Alaska','ORGANISATION','❄️'),
('Hoffman','FAMILLE','🏛️')
on conflict (name) do nothing;

-- Développement rapide : lecture/écriture publiques avec la clé anon.
-- À verrouiller avec Supabase Auth/RLS avant usage réel.
alter table groups enable row level security;
alter table identities enable row level security;
alter table vehicles enable row level security;
alter table intelligence_notes enable row level security;
alter table audit_log enable row level security;
alter table reports enable row level security;
alter table evidence enable row level security;
alter table report_people enable row level security;
alter table report_vehicles enable row level security;
alter table person_relations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['groups','identities','vehicles','intelligence_notes','audit_log','reports','evidence','report_people','report_vehicles','person_relations'] loop
    execute format('drop policy if exists "cid_public_all" on %I', t);
    execute format('create policy "cid_public_all" on %I for all using (true) with check (true)', t);
  end loop;
end $$;
