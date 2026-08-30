-- last-one-agent: decision audit log for the agent
-- Every time run_agent() (single-item) or run_daily_sweep() (whole-fridge)
-- makes a decision, it writes one row here: what it saw, what it decided,
-- and why (or, on failure, what went wrong). Gives a real audit trail
-- instead of only terminal output.

create table agent_decisions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('single_item', 'daily_sweep')),
  item_name text,              -- null for daily_sweep (covers multiple items)
  autonomy_mode text not null,
  context jsonb not null,      -- the facts the agent was given
  tool_calls jsonb not null,   -- what it actually did, in order
  final_message text,
  succeeded boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

create index agent_decisions_item_idx on agent_decisions(item_name);
create index agent_decisions_created_idx on agent_decisions(created_at);

grant select, insert on public.agent_decisions to service_role;
