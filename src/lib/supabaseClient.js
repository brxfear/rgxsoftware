import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

if (!import.meta.env.VITE_SUPABASE_URL) {
    console.warn("Supabase URL is missing. Please set VITE_SUPABASE_URL in your .env file.")
}
