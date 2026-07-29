import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isCloudConfigured, platformConfig } from "./config";

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(
      platformConfig.supabaseUrl,
      platformConfig.supabasePublishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    )
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return supabase;
}
