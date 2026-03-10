import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // Return sample data when no DB configured
    return NextResponse.json([
      { user_id: '1', xp: 100000, level: 99, rank: 'S' },
      { user_id: '2', xp: 95000, level: 98, rank: 'S' }
    ])
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data, error } = await supabase
    .from('hunters')
    .select('user_id, exp as xp, level, rank')
    .order('exp', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
