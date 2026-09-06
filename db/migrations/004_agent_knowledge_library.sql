-- Persistent AI employee knowledge library.
-- Safe to run after the base schema and agent-memory domain migration.
create table if not exists agent_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  agent_id text not null,
  title text not null,
  summary text not null default '',
  source_type text not null default 'manual_note',
  tags text[] not null default '{}',
  content text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_knowledge_items_user_agent_updated_idx
  on agent_knowledge_items(user_id, agent_id, updated_at desc);

alter table agent_knowledge_items enable row level security;
drop policy if exists "agent knowledge owner access" on agent_knowledge_items;
create policy "agent knowledge owner access"
  on agent_knowledge_items
  for all
  to public
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
