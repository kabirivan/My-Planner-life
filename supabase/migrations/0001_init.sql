-- My Planner Life: proyectos y actividades por usuario
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  client text,
  hourly_rate numeric(12, 2) not null default 0 check (hourly_rate >= 0),
  currency text not null default 'USD',
  color text not null default '#6366f1',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  budget_hours numeric(10, 2) check (budget_hours is null or budget_hours >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  date date not null default current_date,
  description text not null default '',
  hours numeric(6, 2) not null default 0 check (hours >= 0),
  created_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists activities_user_date_idx on public.activities (user_id, date desc);
create index if not exists activities_project_id_idx on public.activities (project_id);

alter table public.projects enable row level security;
alter table public.activities enable row level security;

create policy "projects_select_own" on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "projects_insert_own" on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "projects_update_own" on public.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projects_delete_own" on public.projects for delete to authenticated using ((select auth.uid()) = user_id);

create policy "activities_select_own" on public.activities for select to authenticated using ((select auth.uid()) = user_id);
create policy "activities_insert_own" on public.activities for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "activities_update_own" on public.activities for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "activities_delete_own" on public.activities for delete to authenticated using ((select auth.uid()) = user_id);
