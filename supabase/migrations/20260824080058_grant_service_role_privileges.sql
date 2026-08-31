-- last-one-agent: grant service_role privileges
-- The initial schema created tables without corresponding GRANTs, so the
-- backend's SUPABASE_KEY (authenticating as service_role) gets
-- "permission denied for table X" on every query. This grants the
-- backend's CRUD routes (inventory, shopping_list, preferences,
-- recipe_feedback) the access they need on every table in the schema.

grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.shelf_life_lookup,
  public.items,
  public.inventory_log,
  public.shopping_list,
  public.preferences,
  public.recipe_feedback
to service_role;
