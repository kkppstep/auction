-- YBC (Your Board Car) — Supabase schema
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- 1. Admins table (custom login, not Supabase Auth)
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- 2. Cars listed for sale
create table if not exists cars (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  brand text,
  model text,
  year int,
  power text,
  price numeric,
  mileage text,
  transmission text,
  fuel_type text,
  color text,
  description text,
  cover_image_url text,
  status text not null default 'for_sale' check (status in ('for_sale', 'sold')),
  created_at timestamptz default now()
);

-- 3. Auction photos (swipeable feed)
create table if not exists auction_photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  car_id uuid references cars(id) on delete set null,
  likes_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 4. Price offers ("စျေး" submissions)
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  auction_photo_id uuid references auction_photos(id) on delete set null,
  image_url text,
  offer_price text not null,
  buyer_viber_number text not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);

-- 5. Settings (admin contact routing: Viber / Telegram)
create table if not exists settings (
  key text primary key,
  value text
);

insert into settings (key, value) values
  ('admin_viber_number', ''),
  ('admin_phone_number', ''),
  ('admin_telegram_username', ''),
  ('preferred_channel', 'viber')
on conflict (key) do nothing;

-- Row Level Security: the browser (anon key) may only READ public data.
-- All writes go through server API routes using the service role key.
alter table cars enable row level security;
alter table auction_photos enable row level security;
alter table settings enable row level security;
alter table admins enable row level security;
alter table offers enable row level security;

create policy "public read cars" on cars for select using (true);
create policy "public read auction_photos" on auction_photos for select using (true);
create policy "public read settings" on settings for select using (true);
-- admins and offers: no public policies — only accessible via the service role key.

-- Storage bucket for photos (create via SQL or the Supabase dashboard UI)
insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', true)
on conflict (id) do nothing;

create policy "public read car-photos" on storage.objects
  for select using (bucket_id = 'car-photos');

-- 6. Push notification device tokens (buyers who have the Android app installed)
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  platform text default 'android',
  created_at timestamptz default now()
);
alter table push_tokens enable row level security;
-- no public policy — only accessible via the service role key (API routes)
-- 7. Auction posts — one upload batch = one post. Buyers swipe vertically
-- between posts, and horizontally between photos inside a post.
create table if not exists auction_posts (
  id uuid primary key default gen_random_uuid(),
  caption text,
  car_id uuid references cars(id) on delete set null,
  likes_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);
alter table auction_posts enable row level security;
create policy "public read auction_posts" on auction_posts for select using (true);

alter table auction_photos add column if not exists post_id uuid references auction_posts(id) on delete cascade;

-- Migrate any existing standalone photos (from before posts existed) into
-- their own single-photo post so they don't disappear from the feed.
do $$
declare
  r record;
  new_post_id uuid;
begin
  for r in select * from auction_photos where post_id is null loop
    insert into auction_posts (caption, car_id, is_active, created_at)
    values (r.caption, r.car_id, r.is_active, r.created_at)
    returning id into new_post_id;

    update auction_photos set post_id = new_post_id where id = r.id;
  end loop;
end $$;

-- 8. Individual likes per (post, device) — lets the count be real and
-- shared across everyone, while still stopping one device from liking
-- the same post infinitely.
create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references auction_posts(id) on delete cascade,
  device_id text not null,
  created_at timestamptz default now(),
  unique (post_id, device_id)
);
alter table post_likes enable row level security;
create policy "public read post_likes" on post_likes for select using (true);
-- writes only via the service role key (API route) — keeps counting atomic

-- Atomic increment/decrement so concurrent likes from different buyers
-- never race each other into an incorrect count.
create or replace function increment_post_likes(p_post_id uuid, p_delta int)
returns int as $$
declare
  new_count int;
begin
  update auction_posts
  set likes_count = greatest(0, likes_count + p_delta)
  where id = p_post_id
  returning likes_count into new_count;
  return new_count;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- Create your first admin account. Generate a bcrypt hash first, e.g.
-- with Node:  node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
-- then run:
-- insert into admins (username, password_hash) values ('admin', '<paste hash here>');
-- ---------------------------------------------------------------------
-- with Node:  node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
-- then run:
-- insert into admins (username, password_hash) values ('admin', '<paste hash here>');
-- ---------------------------------------------------------------------
