-- Pomo Timer schema. Run once in the Supabase dashboard:
--   SQL Editor -> New query -> paste -> Run
--
-- One row per pomodoro or break. Rows are private to the user who created
-- them (row level security below); the app talks to this table directly with
-- the anon key plus the signed-in user's JWT.

create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  task        text not null default '',
  category    text not null default '',
  type        text not null default 'work' check (type in ('work', 'break')),
  planned_min numeric(6,1) not null,
  actual_min  numeric(6,1) not null,
  completed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists sessions_user_started_idx
  on public.sessions (user_id, started_at desc);

alter table public.sessions enable row level security;

create policy "Users read own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);
