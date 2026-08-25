-- last-one-agent: remove placeholder test data (eggs, milk, coffee)
-- These were seeded manually while testing the agent layer before the
-- CV/category scope was locked to real vegetable categories
-- (leafy_greens, root_vegetable, vegetable_other, fruit). None of these
-- three items fit that scope, so clearing them out before seeding
-- realistic replacements (broccoli, carrots, spinach).

delete from inventory_log where item_id in (select id from items where name in ('eggs', 'milk', 'coffee'));
delete from shopping_list where item_name in ('eggs', 'milk', 'coffee');
delete from items where name in ('eggs', 'milk', 'coffee');
