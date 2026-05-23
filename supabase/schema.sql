-- ============================================================
-- WeRopen database schema
-- Run this in your Supabase project's SQL Editor (one time).
-- ============================================================

-- Businesses: the places people search for.
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  address text,
  city text default 'Austin',
  region text default 'TX',
  -- owner-set status: 'open' | 'closed' | 'uncertain' | null (no owner update)
  owner_status text,
  owner_reason text,
  owner_note text,
  owner_back_to_normal text,
  owner_updated_at timestamptz,
  owner_verified boolean default false,
  usual_hours text,
  created_at timestamptz default now()
);

-- Reports: anonymous community open/closed reports.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  -- 'open' | 'closed'
  vote text not null check (vote in ('open', 'closed')),
  -- coarse client identifier for light de-duplication / rate limiting
  reporter_token text,
  created_at timestamptz default now()
);

create index if not exists reports_business_id_idx on reports(business_id);
create index if not exists reports_created_at_idx on reports(created_at);
create index if not exists businesses_city_idx on businesses(city);

-- ============================================================
-- Row Level Security
-- For v1 (anonymous, no auth) we allow public read on businesses,
-- public read + insert on reports, and public update of owner_* fields.
-- This is intentionally permissive for an MVP. When you add auth,
-- tighten these policies (see SETUP.md, "Hardening" section).
-- ============================================================

alter table businesses enable row level security;
alter table reports enable row level security;

drop policy if exists "public read businesses" on businesses;
create policy "public read businesses"
  on businesses for select
  using (true);

drop policy if exists "public update business status" on businesses;
create policy "public update business status"
  on businesses for update
  using (true)
  with check (true);

drop policy if exists "public read reports" on reports;
create policy "public read reports"
  on reports for select
  using (true);

drop policy if exists "public insert reports" on reports;
create policy "public insert reports"
  on reports for insert
  with check (vote in ('open', 'closed'));

-- ============================================================
-- Seed data: Austin / Central Texas businesses
-- ============================================================

insert into businesses (name, category, address, usual_hours, owner_status, owner_reason, owner_note, owner_verified)
values
  ('HEB — William Cannon', 'Grocery', '2701 E William Cannon Dr', '6am – 11pm', 'open', 'Open with reduced hours', 'All departments open. Expect longer lines.', true),
  ('Torchy''s Tacos — Lamar', 'Restaurant', '1311 S 1st St', '10am – 10pm', null, null, null, false),
  ('Walgreens — S Congress', 'Pharmacy', '1920 S Congress Ave', '8am – 10pm', 'open', 'Open, pharmacist on site', 'Drive-through pharmacy open.', true),
  ('Buc-ee''s — Bastrop', 'Gas Station', '1700 TX-71', '24/7', 'open', 'Always open', null, true),
  ('Magnolia Cafe — S Congress', 'Restaurant', '1920 S Congress Ave', '24 hours', 'closed', 'Closed due to ice storm', 'Stay safe, Austin! See you when roads clear.', true),
  ('Juan in a Million', 'Restaurant', '2300 E Cesar Chavez St', '7am – 3pm', null, null, null, false),
  ('Starbucks — Barton Springs', 'Coffee', '615 Barton Springs Rd', '5am – 9pm', 'closed', 'Lobby closed, drive-thru open', 'Mobile order ahead in the app.', true),
  ('Central Market — N Lamar', 'Grocery', '4001 N Lamar Blvd', '8am – 9pm', 'open', 'Open with storm-adjusted hours', 'Hot food bar available.', true)
on conflict do nothing;
