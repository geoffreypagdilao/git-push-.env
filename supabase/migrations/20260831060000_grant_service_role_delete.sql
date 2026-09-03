-- last-one-agent: grant service_role DELETE on items and shopping_list
-- The grants that actually reached this project (via the feature/agentXP
-- migrations) covered select/insert/update but not delete, so the backend's
-- SUPABASE_KEY (authenticating as service_role) gets "permission denied for
-- table X" on:
--   DELETE /inventory/{id}      (inventory.py -> items)
--   DELETE /shopping-list/{id}  (shopping_list.py -> shopping_list)
-- This adds the missing DELETE privilege for those two tables.
--
-- Note: the earlier local migration 20260824080058 already grants delete on
-- every table, but it was never pushed to this project. This narrower
-- migration is the delete-only fix for what the API currently exercises;
-- GRANT is idempotent, so applying 20260824080058 later is harmless.

grant delete on
  public.items,
  public.shopping_list
to service_role;
