-- last-one-agent: grant service_role privileges on core tables
-- The initial schema migration created these tables but never granted
-- service_role read/write access. The backend's Supabase client
-- authenticates as service_role via the API secret key, so every query
-- was failing with "permission denied for table ..." (Postgres error
-- 42501) until these grants exist.

grant select, insert, update on public.items to service_role;
grant select, insert on public.inventory_log to service_role;
grant select, insert, update on public.shopping_list to service_role;
grant select on public.shelf_life_lookup to service_role;
grant select, insert, update on public.preferences to service_role;
grant select, insert on public.recipe_feedback to service_role;
