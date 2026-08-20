-- Reference schema only - not applied automatically. Run this against your
-- Supabase project's SQL editor to create the tables the backend expects.

create table items (
    id bigint generated always as identity primary key,
    name text not null,
    current_count integer not null default 0
);

create table inventory_log (
    id bigint generated always as identity primary key,
    item_id bigint not null references items (id),
    count integer not null,
    logged_at timestamptz not null default now()
);

create table shopping_list (
    id bigint generated always as identity primary key,
    item_name text not null,
    added_at timestamptz not null default now(),
    fulfilled boolean not null default false
);
