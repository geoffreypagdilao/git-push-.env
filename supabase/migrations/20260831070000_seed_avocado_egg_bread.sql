-- last-one-agent: seed avocado, egg, bread into items
-- Adds three common household items so the dashboard has more than the
-- three produce-drawer test rows. Idempotent: each insert is guarded by a
-- name check, so re-running is a no-op.
--
-- Category notes: only the five produce-drawer categories exist in
-- shelf_life_lookup, so egg and bread fall back to 'uncategorized' (7 days)
-- -- there is no dairy/bakery category yet. avocado maps to 'fruit'.
-- expiry_date is set the same way the webhook would on first detection:
-- current_date + the category's typical_shelf_life_days.

insert into items (name, category, quantity, unit, expiry_date)
select 'avocado', 'fruit', 2, 'pcs', current_date + 6
where not exists (select 1 from items where name = 'avocado');

insert into items (name, category, quantity, unit, expiry_date)
select 'egg', 'uncategorized', 6, 'pcs', current_date + 7
where not exists (select 1 from items where name = 'egg');

insert into items (name, category, quantity, unit, expiry_date)
select 'bread', 'uncategorized', 1, 'loaf', current_date + 7
where not exists (select 1 from items where name = 'bread');
