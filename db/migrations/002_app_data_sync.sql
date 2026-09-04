-- Personal AI Team: app data persistence extension
-- Run after db/schema.sql in the Supabase SQL editor.

create table if not exists study_subjects (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  code text not null default '',
  credits numeric(8,2) not null default 0,
  progress numeric(5,2) not null default 0,
  next_exam_date timestamptz,
  supervisor_tone text,
  teacher_or_notes text,
  status text not null default 'in_progress',
  focus_topics jsonb not null default '[]'::jsonb,
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_study_subjects_user on study_subjects(user_id, updated_at desc);

create table if not exists today_blocks (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  time_range text not null,
  type text not null check (type in ('work','study','rest','buffer')),
  title text not null,
  agent_owner text,
  target_duration_min integer not null default 0,
  completed boolean not null default false,
  notes text,
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_today_blocks_user on today_blocks(user_id, updated_at desc);

-- Prevent duplicate IDs during sync while preserving the user's stable client IDs.
create index if not exists idx_projects_user_source on projects(user_id, source);
create index if not exists idx_tasks_user_source on tasks(user_id, source);
