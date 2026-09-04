-- Personal AI Team: PostgreSQL persistence layer
-- Core rule: conversations are raw history; memories are curated, scoped knowledge.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(), external_id text unique, display_name text,
  timezone text not null default 'Asia/Taipei', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists projects (
  id text primary key, user_id uuid not null references users(id) on delete cascade, workspace_id text not null, title text not null,
  description text, status text, priority text, deadline timestamptz, source text not null default 'user', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists tasks (
  id text primary key, user_id uuid not null references users(id) on delete cascade, project_id text references projects(id) on delete set null,
  subject_id text, domain text not null check (domain in ('work','study')), title text not null, status text not null, priority text,
  start_at timestamptz, deadline timestamptz, estimated_hours numeric(8,2), actual_hours numeric(8,2), progress numeric(5,2), notes text,
  source text not null default 'user', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_user_domain on tasks(user_id, domain);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_deadline on tasks(user_id, deadline);
create index if not exists idx_projects_user_source on projects(user_id, source);
create index if not exists idx_tasks_user_source on tasks(user_id, source);
create table if not exists study_subjects (
  id text primary key, user_id uuid not null references users(id) on delete cascade, name text not null, code text not null default '', credits numeric(8,2) not null default 0,
  progress numeric(5,2) not null default 0, next_exam_date timestamptz, supervisor_tone text, teacher_or_notes text, status text not null default 'in_progress',
  focus_topics jsonb not null default '[]'::jsonb, source text not null default 'user', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_study_subjects_user on study_subjects(user_id, updated_at desc);
create table if not exists today_blocks (
  id text primary key, user_id uuid not null references users(id) on delete cascade, time_range text not null,
  type text not null check (type in ('work','study','rest','buffer')), title text not null, agent_owner text, target_duration_min integer not null default 0,
  completed boolean not null default false, notes text, source text not null default 'user', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_today_blocks_user on today_blocks(user_id, updated_at desc);
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, session_id text not null,
  role text not null check (role in ('user','manager','agent','system')), agent_id text, content text not null,
  project_id text references projects(id) on delete set null, task_id text references tasks(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists idx_conversations_session on conversations(user_id, session_id, created_at);
create table if not exists work_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, project_id text references projects(id) on delete set null,
  task_id text references tasks(id) on delete set null, conversation_id uuid references conversations(id) on delete set null,
  type text not null check (type in ('work','study','problem','decision','knowledge','progress','communication','note')), title text not null, content text not null,
  created_by text not null default 'system', created_at timestamptz not null default now()
);
create index if not exists idx_work_records_scope on work_records(user_id, type, created_at desc);
create table if not exists memories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, domain text not null check (domain in ('global','work','study')),
  type text not null check (type in ('episodic','semantic','procedural','preference','problem','decision','pattern')), content text not null,
  source text not null check (source in ('owner','observed','inferred')), confidence numeric(4,3) not null default 0.500,
  project_id text references projects(id) on delete cascade, task_id text references tasks(id) on delete cascade, evidence_count integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_used_at timestamptz
);
create index if not exists idx_memories_scope on memories(user_id, domain, type, updated_at desc);
create index if not exists idx_memories_project on memories(project_id);
create table if not exists focus_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, task_id text references tasks(id) on delete set null,
  planned_minutes integer not null, actual_minutes integer, started_at timestamptz not null, ended_at timestamptz, completed boolean not null default false,
  interruption_count integer not null default 0, created_at timestamptz not null default now()
);
create index if not exists idx_focus_user_started on focus_sessions(user_id, started_at desc);
create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references users(id) on delete cascade, provider text not null default 'google', google_email text,
  calendar_id text not null default 'primary', access_token text, refresh_token text, expires_at timestamptz, scopes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, google_event_id text not null, calendar_id text not null,
  title text not null, description text, start_at timestamptz not null, end_at timestamptz not null, status text, last_synced_at timestamptz not null default now(),
  unique(user_id, calendar_id, google_event_id)
);
create index if not exists idx_calendar_user_time on calendar_events(user_id, start_at, end_at);
create table if not exists diagnosis_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, type text not null, summary text not null,
  evidence jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create table if not exists adaptive_proposals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, type text not null, title text not null, reason text not null,
  suggested_action text not null, confidence numeric(4,3), source_ids jsonb not null default '[]'::jsonb, status text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists agent_handoffs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, from_agent text not null, to_agent text not null,
  task_id text references tasks(id) on delete set null, project_id text references projects(id) on delete set null, title text not null, reason text not null,
  priority text not null default 'medium', deadline timestamptz, status text not null default 'waiting', payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists idx_agent_handoffs_user_status on agent_handoffs(user_id, status, updated_at desc);
create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, from_agent text not null, to_agent text not null,
  handoff_id uuid references agent_handoffs(id) on delete set null, task_id text references tasks(id) on delete set null, message_type text not null default 'note',
  content text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_agent_messages_user_created on agent_messages(user_id, created_at desc);
create index if not exists idx_agent_messages_handoff on agent_messages(handoff_id, created_at);
create or replace view manager_memory_scope as
select id, user_id, domain, type, content, source, confidence, project_id, task_id, evidence_count, updated_at, last_used_at from memories;
