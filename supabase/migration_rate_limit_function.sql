-- ══════════════════════════════════════════════════════════════════════════════
-- SOLO LEVELING BOT — rate_limit_increment RPC
-- Run this in the Supabase SQL editor after migration_fun_features.sql.
-- Fixes: "Could not find the function public.rate_limit_increment(...) in the schema cache"
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.rate_limit_increment(
  p_bucket_key text,
  p_cmd_key    text,
  p_guild_id   text,
  p_user_id    text
)
returns table (count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.rate_limit_log (user_id, guild_id, cmd_key, bucket_key, count, updated_at)
  values (p_user_id, p_guild_id, p_cmd_key, p_bucket_key, 1, now())
  on conflict (user_id, guild_id, cmd_key, bucket_key)
  do update set
    count      = public.rate_limit_log.count + 1,
    updated_at = now()
  returning public.rate_limit_log.count::bigint;
end;
$$;

-- Expose to PostgREST (schema cache)
comment on function public.rate_limit_increment(text, text, text, text) is 'Increment rate limit counter for (user, guild, cmd, bucket); returns new count';
