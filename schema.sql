-- Gacha Discord Bot - Production Schema
-- Supabase (PostgreSQL)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- VILLAGES
-- ==========================================
create table if not exists villages (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  discord_role_id text not null unique,
  village_rolls integer not null default 0,
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- USERS
-- ==========================================
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  discord_id text not null unique,
  username text not null,
  village_id uuid references villages(id) on delete set null,
  individual_rolls integer not null default 0,
  last_claim_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- REWARDS
-- ==========================================
create table if not exists rewards (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary', 'mythic')),
  weight integer not null default 1,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- REWARD CLAIMS (UNIFIED HISTORY)
-- ==========================================
create table if not exists reward_claims (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  village_id uuid references villages(id) on delete set null,
  reward_id uuid references rewards(id) on delete restrict,
  source text not null check (source in ('individual', 'village')),
  claimed_at timestamptz not null default now()
);

-- ==========================================
-- AUTHORIZED ROLES (PERMISSIONS)
-- ==========================================
create table if not exists authorized_roles (
  id uuid primary key default uuid_generate_v4(),
  discord_role_id text not null unique,
  role_name text not null,
  can_assign_rolls boolean not null default false,
  can_view_audit boolean not null default false,
  created_at timestamptz not null default now()
);

-- ==========================================
-- ROLL ASSIGNMENTS (AUDIT LOG)
-- ==========================================
create table if not exists roll_assignments (
  id uuid primary key default uuid_generate_v4(),
  assigned_by_discord_id text not null,
  assigned_by_username text,
  target_type text not null check (target_type in ('user', 'village')),
  target_user_id uuid references users(id) on delete set null,
  target_village_id uuid references villages(id) on delete set null,
  source text not null,
  quantity integer not null check (quantity > 0),
  assigned_at timestamptz not null default now()
);

-- ==========================================
-- INDEXES
-- ==========================================
create index if not exists idx_users_discord_id on users(discord_id);
create index if not exists idx_users_village_id on users(village_id);
create index if not exists idx_users_last_claim_at on users(last_claim_at);
create index if not exists idx_villages_discord_role_id on villages(discord_role_id);
create index if not exists idx_reward_claims_user_id on reward_claims(user_id);
create index if not exists idx_reward_claims_village_id on reward_claims(village_id);
create index if not exists idx_reward_claims_claimed_at on reward_claims(claimed_at desc);
create index if not exists idx_roll_assignments_target_user on roll_assignments(target_user_id);
create index if not exists idx_roll_assignments_target_village on roll_assignments(target_village_id);
create index if not exists idx_roll_assignments_assigned_at on roll_assignments(assigned_at desc);
create index if not exists idx_authorized_roles_discord_role_id on authorized_roles(discord_role_id);

-- ==========================================
-- UPDATED_AT TRIGGER FUNCTION
-- ==========================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_users_updated_at
  before update on users
  for each row
  execute function update_updated_at_column();

create trigger update_villages_updated_at
  before update on villages
  for each row
  execute function update_updated_at_column();

create trigger update_rewards_updated_at
  before update on rewards
  for each row
  execute function update_updated_at_column();

-- ==========================================
-- SEED DATA (example)
-- ==========================================
insert into villages (name, discord_role_id, village_rolls) values
  ('Aldea Hoja', '1126921918554067038', 10),
  ('Aldea Arena', '1126921918554067039', 10),
  ('Aldea Niebla', '1126921918554067040', 10)
on conflict (discord_role_id) do nothing;

insert into rewards (name, rarity, weight, image_url, active) values
  ('Kunai Comun', 'common', 50, 'https://example.com/kunai.png', true),
  ('Pergamino Raro', 'rare', 25, 'https://example.com/pergamino.png', true),
  ('Espada Epica', 'epic', 10, 'https://example.com/espada.png', true),
  ('Arma Legendaria', 'legendary', 3, 'https://example.com/legendaria.png', true),
  ('Tesoro Mitico', 'mythic', 1, 'https://example.com/mitico.png', true)
on conflict do nothing;
