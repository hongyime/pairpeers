const CLAIM_CODE = /^PP-[A-Za-z0-9_-]+$/;

export function parseStartPayload(text: string): string | null {
  const parts = text.trim().split(/\s+/);
  if (parts[0]?.split("@")[0] !== "/start") return null;
  const payload = parts[1];
  return payload && CLAIM_CODE.test(payload) ? payload : null;
}
