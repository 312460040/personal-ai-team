create table if not exists public.personal_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  frequency text not null default 'daily' check (frequency in ('daily','weekly','custom')),
  target_days jsonb not null default '[]'::jsonb,
  reminder_time time,
  active boolean not null default true,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_completed_on date,
  source text not null default 'user' check (source in ('user','agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists personal_habits_user_active_idx on public.personal_habits(user_id, active);
create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.personal_habits(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  checkin_date date not null,
  note text,
  created_at timestamptz not null default now(),
  unique(habit_id, checkin_date)
);
create index if not exists habit_checkins_user_date_idx on public.habit_checkins(user_id, checkin_date desc);
create table if not exists public.personal_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default '',
  content text not null,
  pinned boolean not null default false,
  archived boolean not null default false,
  source text not null default 'user' check (source in ('user','agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists personal_memos_user_updated_idx on public.personal_memos(user_id, updated_at desc);
