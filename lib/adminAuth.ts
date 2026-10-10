import { getSessionTelegramId } from "./auth.ts";
import { getProfileByTelegramId, type Profile } from "./profiles.ts";

export type AdminAuthRequest = {
  headers: { get(name: string): string | null };
  cookies: { get(name: string): { value: string } | undefined };
};

export type FounderAuthSuccess = {
  ok: true;
  supabase: any;
  cron: boolean;
  profile: Profile | null;
  error?: never;
  status?: never;
};

export type FounderAuthFailure = {
  ok: false;
  error: "not_configured" | "unauthorized" | "forbidden";
  status: 503 | 401 | 403;
  supabase?: never;
  cron?: never;
  profile?: never;
};

export type FounderAuthResult = FounderAuthSuccess | FounderAuthFailure;

/**
 * Shared route auth helper for all founder/admin endpoints.
 * Accepts Vercel Cron (Authorization: Bearer <CRON_SECRET>) or an authenticated
 * session for a profile with is_founder = true.
 */
export async function requireFounder(
  req: AdminAuthRequest,
  supabaseOverride?: any
): Promise<FounderAuthResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !supabaseOverride) {
    return { ok: false, error: "not_configured", status: 503 };
  }

  const cronSecret = process.env.CRON_SECRET;
  const cronOk = !!cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (cronOk) {
    const supabase =
      supabaseOverride ?? (await (await import("./supabaseServer.ts")).createSupabaseServerClient());
    return { ok: true, supabase, cron: true, profile: null };
  }

  const telegramId = await getSessionTelegramId(req as any);
  if (!telegramId) {
    return { ok: false, error: "unauthorized", status: 401 };
  }

  const supabase =
    supabaseOverride ?? (await (await import("./supabaseServer.ts")).createSupabaseServerClient());
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile) {
    return { ok: false, error: "unauthorized", status: 401 };
  }

  if (!profile.is_founder) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  return { ok: true, supabase, cron: false, profile };
}

/**
 * Server-component / layout level founder check.
 * Redirects to /login if unauthenticated or non-founder.
 */
export async function requireFounderSession(): Promise<{
  profile: Profile;
  telegramId: number;
  supabase: any;
}> {
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const { SESSION_COOKIE, verifySessionToken } = await import("./session.ts");
  const { createSupabaseServerClient } = await import("./supabaseServer.ts");

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const telegramId =
    secret && token
      ? (await verifySessionToken(token, secret))?.telegramId ?? null
      : null;
  if (typeof telegramId !== "number") {
    redirect("/login");
    throw new Error("unreachable");
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile || !profile.is_founder) {
    redirect("/login");
    throw new Error("unreachable");
  }

  return { profile, telegramId, supabase };
}
