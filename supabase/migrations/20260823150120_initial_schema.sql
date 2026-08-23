-- last-one-agent: initial schema
-- Covers all 3 features: auto-cart, recipe generation, expiry tracking
-- Scope decisions baked in: single veggie-drawer camera (transparent
-- produce bags solve the opaque-bottle CV problem), no Google Places
-- integration, no Stripe — "Confirm & pay" flips status internally.

create extension if not exists "pgcrypto";

-- ============================================================
-- shelf_life_lookup  (feature 3: expiry-aware waste tracking)
-- Static category -> typical shelf life, in days. Auto-applied
-- the instant an item is first detected — no user input needed.
-- Trimmed to categories the veggie-drawer camera can realistically
-- see. Expand later if you add more cameras/zones; anything
-- unmapped falls back to 'uncategorized' rather than failing.
-- ============================================================
create table shelf_life_lookup (
  category text primary key,
  typical_shelf_life_days integer not null,
  notes text
);

insert into shelf_life_lookup (category, typical_shelf_life_days, notes) values
  ('leafy_greens',     5,  'spinach, lettuce, kale'),
  ('root_vegetable',   14, 'carrots, potatoes, onions'),
  ('vegetable_other',  7,  'broccoli, peppers, tomatoes'),
  ('fruit',            6,  'if fruit ever shares the drawer'),
  ('uncategorized',    7,  'fallback default for unmapped CV labels');

-- ============================================================
-- items  (current fridge/pantry state)
-- One row per tracked item type. Quantity is updated in place
-- as the CV agent detects changes; expiry_date is computed once
-- at first detection (in agent code, not a DB trigger — see
-- README note). last_notified_at prevents the notification tool
-- from re-alerting on the same expiring item every run.
-- ============================================================
create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null references shelf_life_lookup(category) default 'uncategorized',
  quantity numeric not null default 0,
  unit text not null default 'pcs',
  first_detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expiry_date date,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_category_idx on items(category);
create index items_expiry_idx on items(expiry_date);

-- ============================================================
-- inventory_log  (append-only event log)
-- Every detected add/remove event. This is what consumption-
-- pace learning reads: time between 'removed' events on the
-- same item ≈ how fast it gets used; time between a 'removed'
-- and the next 'added' ≈ restock cadence. No separate pace
-- table needed — it's a query over this log.
-- ============================================================
create table inventory_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  event_type text not null check (event_type in ('added', 'removed')),
  quantity_delta numeric not null,
  detected_at timestamptz not null default now(),
  source text not null default 'cv_webcam'
);

create index inventory_log_item_idx on inventory_log(item_id, detected_at);

-- ============================================================
-- shopping_list  (feature 1: cart-staging)
-- status drives the dashboard: pending -> in_cart -> purchased.
-- "Confirm & pay" flips status directly to 'purchased' — no
-- Stripe, no payment fields, nothing external. store_link is
-- just a cached FairPrice/RedMart search-results URL, not a
-- real add-to-cart action.
-- Application-level rule (not a DB constraint, to keep this
-- simple): before inserting a new row, check whether a
-- non-purchased row already exists for the same item_id, so a
-- repeat low-stock detection doesn't create a duplicate cart entry.
-- ============================================================
create table shopping_list (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete set null,
  item_name text not null,   -- denormalized so a row survives item deletion
  status text not null default 'pending' check (status in ('pending', 'in_cart', 'purchased')),
  store_link text,
  staged_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index shopping_list_status_idx on shopping_list(status);

-- ============================================================
-- preferences  (feature 2: persisted recipe personalization)
-- Single-household assumption for the hackathon build: one
-- active row, no user_id, no location field (Google Places
-- integration dropped, so nothing needs a location).
-- ============================================================
create table preferences (
  id uuid primary key default gen_random_uuid(),
  dietary_restrictions text[] not null default '{}',   -- e.g. {'vegetarian','no_shellfish'}
  cuisine_preferences text[] not null default '{}',     -- e.g. {'italian','japanese'}
  updated_at timestamptz not null default now()
);

-- ============================================================
-- recipe_feedback  (feature 2: behavioral signal)
-- Thumbs up/down on generated recipes, so future generations
-- can lean into liked patterns and avoid repeating disliked ones.
-- ============================================================
create table recipe_feedback (
  id uuid primary key default gen_random_uuid(),
  recipe_title text not null,
  liked boolean not null,
  ingredients_used text[],   -- snapshot of pantry items the recipe called for
  created_at timestamptz not null default now()
);