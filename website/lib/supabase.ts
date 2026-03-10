import { createClient } from '@supabase/supabase-js'

// WARNING: In a production public frontend, use an ANON key instead of a SERVICE key.
// The current setup uses the bot's service role, which should be used with caution in publicly accessible pages.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)
