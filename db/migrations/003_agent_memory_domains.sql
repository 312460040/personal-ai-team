-- Extend the persistent memory model for the four logical agent banks.
-- Manager and Research were added at the application layer; keep the database
-- constraint in sync so those memories can actually be written.
alter table memories drop constraint if exists memories_domain_check;
alter table memories add constraint memories_domain_check check (
  domain = any (array['global'::text,'manager'::text,'work'::text,'study'::text,'research'::text])
);

-- agent-memory records are system-observed memories written by the agent layer.
alter table memories drop constraint if exists memories_source_check;
alter table memories add constraint memories_source_check check (
  source = any (array['owner'::text,'observed'::text,'inferred'::text,'agent-memory'::text])
);
