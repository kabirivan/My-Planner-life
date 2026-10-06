create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null,
  client text,
  hourly_rate numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  color text not null default '#6366f1',
  status text not null default 'active',
  budget_hours numeric(10, 2),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.projects
  add constraint projects_status_check
  check (status in ('active', 'paused', 'archived'));

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  project_id uuid
    references public.projects (id) on delete set null,
  date date not null default current_date,
  description text not null default '',
  hours numeric(6, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index on public.projects (user_id);
create index on public.activities (user_id, date desc);
create index on public.activities (project_id);

alter table public.projects enable row level security;
alter table public.activities enable row level security;

create policy "projects_own" on public.projects
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "activities_own" on public.activities
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
