-- ══════════════════════════════════════════════════════════════════════════════
-- SOLO LEVELING BOT — FUN FEATURES MIGRATION
-- Run this in the Supabase SQL editor ONCE.
-- Tables: daily_spin, hunter_achievements, hunter_streaks, loot_boxes, rate_limit_log
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Daily Spin / Slot Machine ───────────────────────────────────────────────
create table if not exists public.daily_spin (
  user_id     text not null,
  guild_id    text not null check (guild_id = '1425973312588091394'),
  date_key    text not null,          -- UTC date "YYYY-MM-DD"
  spun        boolean not null default false,
  result      text,                   -- JSON string of spin result
  reward_xp   integer not null default 0 check (reward_xp >= 0),
  reward_gold integer not null default 0 check (reward_gold >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, guild_id, date_key)
);

-- ─── Hunter Achievements ─────────────────────────────────────────────────────
create table if not exists public.hunter_achievements (
  user_id         text not null,
  guild_id        text not null check (guild_id = '1425973312588091394'),
  achievement_key text not null,
  unlocked_at     timestamptz not null default now(),
  primary key (user_id, guild_id, achievement_key)
);

-- ─── Daily Login Streak ───────────────────────────────────────────────────────
create table if not exists public.hunter_streaks (
  user_id       text not null,
  guild_id      text not null check (guild_id = '1425973312588091394'),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_claim_key  text,               -- UTC date "YYYY-MM-DD" of last streak claim
  updated_at     timestamptz not null default now(),
  primary key (user_id, guild_id)
);

-- ─── Loot Boxes ──────────────────────────────────────────────────────────────
create table if not exists public.loot_box_opens (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  guild_id    text not null check (guild_id = '1425973312588091394'),
  box_tier    text not null default 'common', -- common | rare | epic | legendary
  opened_at   timestamptz not null default now(),
  reward_json text                             -- JSON snapshot of reward
);

-- ─── Rate Limit Log (API abuse guard) ─────────────────────────────────────────
-- One row per user per command per minute-bucket, tracks call count.
create table if not exists public.rate_limit_log (
  user_id    text not null,
  guild_id   text not null check (guild_id = '1425973312588091394'),
  cmd_key    text not null,
  bucket_key text not null,           -- "YYYY-MM-DDTHH:MM" (minute)
  count      integer not null default 1 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, guild_id, cmd_key, bucket_key)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_daily_spin_user_guild_date   on public.daily_spin(user_id, guild_id, date_key);
create index if not exists idx_achievements_user_guild      on public.hunter_achievements(user_id, guild_id);
create index if not exists idx_streaks_user_guild           on public.hunter_streaks(user_id, guild_id);
create index if not exists idx_loot_box_user_guild          on public.loot_box_opens(user_id, guild_id);
create index if not exists idx_rate_limit_user_cmd          on public.rate_limit_log(user_id, guild_id, cmd_key, bucket_key);

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
alter table if exists public.daily_spin          enable row level security;
alter table if exists public.hunter_achievements enable row level security;
alter table if exists public.hunter_streaks      enable row level security;
alter table if exists public.loot_box_opens      enable row level security;
alter table if exists public.rate_limit_log      enable row level security;

-- ─── Updated-at triggers ────────────────────────────────────────────────────
drop trigger if exists trg_daily_spin_updated_at on public.daily_spin;
create trigger trg_daily_spin_updated_at
  before update on public.daily_spin
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_hunter_streaks_updated_at on public.hunter_streaks;
create trigger trg_hunter_streaks_updated_at
  before update on public.hunter_streaks
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_rate_limit_updated_at on public.rate_limit_log;
create trigger trg_rate_limit_updated_at
  before update on public.rate_limit_log
  for each row execute function public.tg_set_updated_at();
