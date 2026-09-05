create table if not exists public.agent_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  agent_id text not null,
  title text not null,
  summary text not null default '',
  source_type text not null default 'manual_note' check (source_type in ('document','owner_preference','conversation_learning','manual_note')),
  tags text[] not null default '{}',
  content text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_knowledge_items_user_agent_idx on public.agent_knowledge_items(user_id, agent_id, updated_at desc);

alter table public.agent_knowledge_items enable row level security;

create policy "agent knowledge owner access" on public.agent_knowledge_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_agent_knowledge_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists agent_knowledge_items_touch_updated_at on public.agent_knowledge_items;
create trigger agent_knowledge_items_touch_updated_at
before update on public.agent_knowledge_items
for each row execute function public.touch_agent_knowledge_updated_at();
