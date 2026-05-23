import { createClient } from '@supabase/supabase-js';

// These come from your environment variables (.env.local locally,
// or Vercel project settings in production). They are safe to expose
// to the browser — the anon key only grants what your RLS policies allow.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This throws early with a clear message if the keys are missing,
  // instead of a confusing error deep in a request.
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'See SETUP.md.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
