import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. Never import this file from a "use client" component —
// it uses the service role key which must stay secret.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
