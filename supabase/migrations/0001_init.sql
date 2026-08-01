-- Walks with Yaya — core schema
-- Single-operator model: one authenticated user (Yaya) manages everything.
-- Public visitors can only (a) submit a lead, and (b) view one walk's live
-- position / report if they hold that walk's share_token.

create extension if not exists "pgcrypto";

-- ── People & dogs ──────────────────────────────────────────────────────────

create table clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table dogs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  breed text,
  notes text, -- temperament, allergies, meds, gate code, etc.
  photo_url text,
  created_at timestamptz not null default now()
);

-- ── Leads (public contact form) ────────────────────────────────────────────
-- "Call me" capture, not a booking — Yaya reaches out and books manually.

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  best_time_to_call text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'closed')),
  created_at timestamptz not null default now()
);

-- ── Bookings & walks ────────────────────────────────────────────────────────

create table bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  service_type text not null default 'walk',
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30,
  recurring_note text, -- free text, e.g. "every Tue/Thu" — no auto-recurrence engine yet
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table walks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  client_id uuid not null references clients(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  share_token text not null unique default encode(gen_random_bytes(12), 'base64url'),
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  distance_meters numeric,
  created_at timestamptz not null default now()
);

create table walk_points (
  id bigint generated always as identity primary key,
  walk_id uuid not null references walks(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now()
);
create index walk_points_walk_id_idx on walk_points(walk_id, recorded_at);

create table walk_events (
  id uuid primary key default gen_random_uuid(),
  walk_id uuid not null references walks(id) on delete cascade,
  type text not null check (type in ('potty', 'water', 'photo', 'note')),
  note text,
  photo_path text, -- storage object path in the walk-photos bucket
  created_at timestamptz not null default now()
);
create index walk_events_walk_id_idx on walk_events(walk_id, created_at);

-- ── Admin allowlist ─────────────────────────────────────────────────────────
-- Supabase Auth alone isn't a lock: with public sign-up left on, ANY visitor
-- who requests a magic link becomes "authenticated". Every admin policy below
-- also checks this table, so access stays limited to whoever's email is in it
-- — set up in the README's setup steps regardless of the project's sign-up
-- setting.

create table admins (
  email text primary key
);

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;
grant execute on function is_admin() to authenticated;

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Yaya signs in via Supabase Auth (magic link) and gets full access to
-- everything, gated by is_admin(). Everyone else (anon) can only insert a
-- lead, and read a walk through the two token-gated functions below.

alter table clients enable row level security;
alter table dogs enable row level security;
alter table leads enable row level security;
alter table bookings enable row level security;
alter table walks enable row level security;
alter table walk_points enable row level security;
alter table walk_events enable row level security;

create policy "yaya full access - clients" on clients for all to authenticated using (is_admin()) with check (is_admin());
create policy "yaya full access - dogs" on dogs for all to authenticated using (is_admin()) with check (is_admin());
create policy "yaya full access - bookings" on bookings for all to authenticated using (is_admin()) with check (is_admin());
create policy "yaya full access - walks" on walks for all to authenticated using (is_admin()) with check (is_admin());
create policy "yaya full access - walk_points" on walk_points for all to authenticated using (is_admin()) with check (is_admin());
create policy "yaya full access - walk_events" on walk_events for all to authenticated using (is_admin()) with check (is_admin());

create policy "yaya read/update leads" on leads for select to authenticated using (is_admin());
create policy "yaya update leads" on leads for update to authenticated using (is_admin()) with check (is_admin());
create policy "anyone can submit a lead" on leads for insert to anon with check (true);

-- ── Token-gated public read for the client tracking link ──────────────────
-- security definer functions bypass RLS deliberately, but only ever return
-- rows for the single walk matching the token the caller already holds.

create or replace function get_walk_by_token(token text)
returns table (
  id uuid,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  distance_meters numeric,
  dog_name text
)
language sql security definer set search_path = public as $$
  select w.id, w.status, w.started_at, w.ended_at, w.distance_meters, d.name
  from walks w join dogs d on d.id = w.dog_id
  where w.share_token = token;
$$;
grant execute on function get_walk_by_token(text) to anon;

create or replace function get_walk_points_by_token(token text)
returns table (lat double precision, lng double precision, recorded_at timestamptz)
language sql security definer set search_path = public as $$
  select p.lat, p.lng, p.recorded_at
  from walk_points p join walks w on w.id = p.walk_id
  where w.share_token = token
  order by p.recorded_at;
$$;
grant execute on function get_walk_points_by_token(text) to anon;

create or replace function get_walk_events_by_token(token text)
returns table (type text, note text, photo_path text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select e.type, e.note, e.photo_path, e.created_at
  from walk_events e join walks w on w.id = e.walk_id
  where w.share_token = token
  order by e.created_at;
$$;
grant execute on function get_walk_events_by_token(text) to anon;
