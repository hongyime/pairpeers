import { createHmac, timingSafeEqual } from "node:crypto";

export type MiniAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
};

export type ValidatedInitData = {
  user: MiniAppUser;
  authDate: number;
  queryId?: string;
  chatType?: string;
  chatInstance?: string;
  startParam?: string;
  rawParams: Record<string, string>;
};

export type ValidateInitDataResult =
  | { ok: true; data: ValidatedInitData }
  | { ok: false; error: string };

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // 24 hours per Telegram spec

/**
 * Validates Telegram Mini App initData per official specification:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * 1. Parses query string into key-value pairs.
 * 2. Builds data_check_string from sorted pairs excluding `hash`.
 * 3. Derives secret_key = HMAC_SHA256(bot_token, key="WebAppData").
 * 4. Compares HMAC_SHA256(data_check_string, secret_key) (hex) with received hash
 *    using timing-safe comparison.
 * 5. Rejects if auth_date is older than 24h (replay protection).
 * 6. Parses and extracts the user object.
 */
export function validateTelegramInitData(
  rawInitData: string,
  botToken: string,
  options?: {
    maxAgeSeconds?: number;
    nowUnix?: number;
  }
): ValidateInitDataResult {
  if (!rawInitData || typeof rawInitData !== "string") {
    return { ok: false, error: "empty_init_data" };
  }

  const params = new URLSearchParams(rawInitData);
  const receivedHash = params.get("hash");
  if (!receivedHash) {
    return { ok: false, error: "missing_hash" };
  }

  // Build data_check_string from sorted key=<value> pairs excluding `hash`
  const pairs: Array<[string, string]> = [];
  const rawParams: Record<string, string> = {};
  params.forEach((value, key) => {
    rawParams[key] = value;
    if (key !== "hash") {
      pairs.push([key, value]);
    }
  });

  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  // secret_key = HMAC_SHA256(bot_token, key="WebAppData")
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  // HMAC_SHA256(data_check_string, secret_key) (hex)
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Timing-safe comparison with received hash
  const expectedBuf = Buffer.from(expectedHash, "utf8");
  const receivedBuf = Buffer.from(receivedHash, "utf8");
  if (
    expectedBuf.length !== receivedBuf.length ||
    !timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    return { ok: false, error: "invalid_signature" };
  }

  // Check auth_date
  const authDateStr = params.get("auth_date");
  if (!authDateStr) {
    return { ok: false, error: "missing_auth_date" };
  }
  const authDate = Number(authDateStr);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { ok: false, error: "invalid_auth_date" };
  }

  const maxAge = options?.maxAgeSeconds ?? MAX_AUTH_AGE_SECONDS;
  const now = options?.nowUnix ?? Math.floor(Date.now() / 1000);

  // Reject if auth_date is older than 24h
  if (now - authDate > maxAge) {
    return { ok: false, error: "stale_auth_date" };
  }

  // Reject if auth_date is unreasonably in the future (> 5 min clock skew tolerance)
  if (authDate - now > 300) {
    return { ok: false, error: "future_auth_date" };
  }

  // Parse user
  const userStr = params.get("user");
  if (!userStr) {
    return { ok: false, error: "missing_user" };
  }

  let userRaw: unknown;
  try {
    userRaw = JSON.parse(userStr);
  } catch {
    return { ok: false, error: "invalid_user_json" };
  }

  if (!userRaw || typeof userRaw !== "object") {
    return { ok: false, error: "invalid_user_object" };
  }

  const u = userRaw as Record<string, unknown>;
  const rawId = u.id;
  const idNum =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string" && /^\d+$/.test(rawId)
      ? Number(rawId)
      : NaN;

  if (!Number.isSafeInteger(idNum) || idNum <= 0) {
    return { ok: false, error: "invalid_user_id" };
  }

  const user: MiniAppUser = {
    id: idNum,
    first_name: typeof u.first_name === "string" ? u.first_name : "",
    last_name: typeof u.last_name === "string" ? u.last_name : undefined,
    username: typeof u.username === "string" ? u.username : undefined,
    language_code:
      typeof u.language_code === "string" ? u.language_code : undefined,
    is_premium: typeof u.is_premium === "boolean" ? u.is_premium : undefined,
    allows_write_to_pm:
      typeof u.allows_write_to_pm === "boolean"
        ? u.allows_write_to_pm
        : undefined,
    photo_url: typeof u.photo_url === "string" ? u.photo_url : undefined,
  };

  return {
    ok: true,
    data: {
      user,
      authDate,
      queryId: params.get("query_id") ?? undefined,
      chatType: params.get("chat_type") ?? undefined,
      chatInstance: params.get("chat_instance") ?? undefined,
      startParam: params.get("start_param") ?? undefined,
      rawParams,
    },
  };
}

/**
 * Constructs a signed initData string for testing or fixture generation.
 */
export function buildTestInitData(
  params: Record<string, string>,
  botToken: string
): string {
  const searchParams = new URLSearchParams(params);
  searchParams.delete("hash");

  const pairs: Array<[string, string]> = [];
  searchParams.forEach((val, key) => pairs.push([key, val]));
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  searchParams.set("hash", hash);
  return searchParams.toString();
}
