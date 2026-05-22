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

  // Use process.env for server-only vars — Astro's import.meta.env doesn't
  // reliably surface non-PUBLIC env vars at runtime in @astrojs/vercel
  // serverless mode.
  //
  // Accept multiple env-var name conventions so we work regardless of how
  // the project was set up:
  //   - PUBLIC_SUPABASE_URL          (Astro convention)
  //   - NEXT_PUBLIC_SUPABASE_URL     (Next.js convention; matches internal-app)
  //   - SUPABASE_URL                 (plain)
  const url =
    process.env.PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      `Missing Supabase env vars. Looked for url in PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL (found: ${url ? "yes" : "no"}); SUPABASE_SERVICE_ROLE_KEY (found: ${serviceKey ? "yes" : "no"})`,
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
