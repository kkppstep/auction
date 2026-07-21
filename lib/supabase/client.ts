import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client used in the browser (public, respects Row Level Security policies)
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);
