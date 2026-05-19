// Server-side Supabase client. Uses the SERVICE_ROLE key, which bypasses RLS.
// MUST only be imported from src/pages/api/*. Never from a client component.
//
// Required Vercel environment variables:
//   PUBLIC_SUPABASE_URL          — Supabase project URL (browser-safe; the same
//                                  URL is used by both server and any future
//                                  anon-key reads, so we keep the PUBLIC_ prefix
//                                  even though API routes are the only callers
//                                  right now).
//   SUPABASE_SERVICE_ROLE_KEY    — service-role JWT, server-only.
//
// Astro strips any env var WITHOUT a PUBLIC_ prefix from client bundles
// automatically, so importing this file from a client component would compile
// to an `undefined` value for the service-role key and fail loudly.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var",
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
