-- ══════════════════════════════════════════════════════════════════════════════
-- SOLO LEVELING BOT — MEGA EXPANSION MIGRATION
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Add new columns to hunters ──────────────────────────────────────────────
ALTER TABLE public.hunters ADD COLUMN IF NOT EXISTS race TEXT DEFAULT 'human';
ALTER TABLE public.hunters ADD COLUMN IF NOT EXISTS sub_class TEXT;
ALTER TABLE public.hunters ADD COLUMN IF NOT EXISTS monarchs_unlocked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.hunters ADD COLUMN IF NOT EXISTS monarchs_inventory JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.hunters ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '{"weapon": null, "armor_set": null, "necklace": null, "ring": null}'::jsonb;
ALTER TABLE public.hunters ADD COLUMN IF NOT EXISTS unlocked_islands JSONB DEFAULT '["Default Island"]'::jsonb;

-- ─── Guild Battles Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guild_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    opponent_guild_id TEXT NOT NULL,
    winner_guild_id TEXT,
    battle_type TEXT DEFAULT 'normal', -- normal, war, raid
    status TEXT DEFAULT 'pending', -- pending, active, completed
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Hunter Passives/Skills Table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hunter_skills (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    skill_key TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    unlocked_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, guild_id, skill_key),
    FOREIGN KEY (user_id, guild_id) REFERENCES public.hunters(user_id, guild_id) ON DELETE CASCADE
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hunters_race ON public.hunters(race);
CREATE INDEX IF NOT EXISTS idx_guild_battles_guilds ON public.guild_battles(guild_id, opponent_guild_id);
