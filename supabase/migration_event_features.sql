create table if not exists public.event_user_stats (
  guild_id text not null check (guild_id = '1425973312588091394'),
  user_id text not null,
  combat_power integer not null default 0,
  top_gold integer not null default 0,
  dungeon_clears integer not null default 0,
  damage_dealt integer not null default 0,
  highest_damage integer not null default 0,
  heals_done integer not null default 0,
  extreme_gate_clears integer not null default 0,
  weekly_score integer not null default 0,
  prestige integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists public.event_factions (
  guild_id text not null check (guild_id = '1425973312588091394'),
  user_id text not null,
  faction text not null,
  weekly_score integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists public.event_daily_quests (
  guild_id text not null check (guild_id = '1425973312588091394'),
  user_id text not null,
  date_key text not null,
  hunts integer not null default 0,
  dungeons integer not null default 0,
  gold_spent integer not null default 0,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id, date_key)
);

create table if not exists public.event_weekly_quests (
  guild_id text not null check (guild_id = '1425973312588091394'),
  user_id text not null,
  week_key text not null,
  damage integer not null default 0,
  heals integer not null default 0,
  extreme_gate integer not null default 0,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id, week_key)
);

create table if not exists public.guild_clans (
  discord_guild_id text not null check (discord_guild_id = '1425973312588091394'),
  clan_id text not null,
  name text not null,
  logo_url text not null default '',
  description text not null default '',
  owner_user_id text not null,
  min_level integer not null default 20,
  score integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (discord_guild_id, clan_id)
);

create table if not exists public.guild_clan_members (
  discord_guild_id text not null check (discord_guild_id = '1425973312588091394'),
  clan_id text not null,
  user_id text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (discord_guild_id, user_id)
);

create index if not exists idx_event_user_stats_weekly_score on public.event_user_stats(guild_id, weekly_score desc);
create index if not exists idx_event_factions_weekly_score on public.event_factions(guild_id, weekly_score desc);
create index if not exists idx_guild_clans_owner on public.guild_clans(discord_guild_id, owner_user_id);
create index if not exists idx_guild_members_clan on public.guild_clan_members(discord_guild_id, clan_id);

