import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (Server Components / Route Handlers).
 * Reads NEXT_PUBLIC_SUPABASE_URL.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY when set (bypasses RLS — all app DB access
 * is server-side and already gated by our Telegram session auth), falling
 * back to the anon key while the permissive pilot RLS is still in place.
 * Async: Next.js 15+ requires `await cookies()`.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY not set — using anon key (pilot RLS)"
    );
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where setting cookies is not allowed.
          }
        },
      },
    }
  );
}
