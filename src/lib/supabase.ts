import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cxtystgaxoeygwbvgqcg.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseKey) {
  throw new Error('Missing Supabase anon key')
}

export const supabase = createClient(supabaseUrl, supabaseKey) 