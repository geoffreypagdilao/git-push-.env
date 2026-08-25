-- last-one-agent: seed realistic vegetable test data for the agent
-- Replaces the removed eggs/milk/coffee placeholders (see
-- 20260825234500_cleanup_placeholder_test_items.sql) with items that
-- actually match the veggie-drawer camera's real category scope, so
-- agent test runs reflect data the CV pipeline could really produce.
--
-- Three scenarios, mirroring what was already validated with the
-- placeholder items:
--   broccoli (vegetable_other): comfortable buffer -> suggest mode,
--     no restock action expected
--   carrots  (root_vegetable):  ~1 day to projected depletion ->
--     autopilot mode, should trigger add_to_shopping_list + place_order
--   spinach  (leafy_greens):    no consumption history yet -> cold
--     start, suggest mode should stage defensively

insert into items (name, category, quantity, unit, expiry_date) values
  ('broccoli', 'vegetable_other', 3, 'heads', '2026-09-08'),
  ('carrots',  'root_vegetable',  1, 'pcs',   '2027-01-01'),
  ('spinach',  'leafy_greens',    1, 'bag',   '2026-08-30');

insert into inventory_log (item_id, event_type, quantity_delta, detected_at, source) values
  ((select id from items where name = 'broccoli'), 'removed', -1, '2026-08-13T09:00:00Z', 'manual_seed'),
  ((select id from items where name = 'broccoli'), 'removed', -1, '2026-08-17T09:00:00Z', 'manual_seed'),
  ((select id from items where name = 'broccoli'), 'removed', -1, '2026-08-21T09:00:00Z', 'manual_seed'),
  ((select id from items where name = 'carrots'),  'removed', -1, '2026-08-21T09:00:00Z', 'manual_seed'),
  ((select id from items where name = 'carrots'),  'removed', -1, '2026-08-22T09:00:00Z', 'manual_seed'),
  ((select id from items where name = 'carrots'),  'removed', -1, '2026-08-23T09:00:00Z', 'manual_seed'),
  ((select id from items where name = 'carrots'),  'removed', -1, '2026-08-24T09:00:00Z', 'manual_seed');
  -- spinach intentionally has no removed events (cold-start scenario)
