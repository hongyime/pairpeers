import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  validateTelegramInitData,
  buildTestInitData,
} from "./telegramMiniApp.ts";

const TEST_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz_1234567";

test("validateTelegramInitData accepts valid hand-constructed initData", () => {
  const now = Math.floor(Date.now() / 1000);
  const userPayload = JSON.stringify({
    id: 99887766,
    first_name: "Bryan",
    last_name: "Lim",
    username: "bryanlim",
  });

  // Manually construct the data_check_string and hash to verify from first principles
  const params: Record<string, string> = {
    auth_date: String(now),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: userPayload,
  };

  // Build data_check_string manually: sorted alphabetically by key: auth_date, query_id, user
  const dataCheckString = [
    `auth_date=${params.auth_date}`,
    `query_id=${params.query_id}`,
    `user=${params.user}`,
  ].join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(TEST_BOT_TOKEN)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Construct raw initData string
  const urlParams = new URLSearchParams(params);
  urlParams.set("hash", expectedHash);
  const rawInitData = urlParams.toString();

  const result = validateTelegramInitData(rawInitData, TEST_BOT_TOKEN);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.user.id, 99887766);
    assert.equal(result.data.user.first_name, "Bryan");
    assert.equal(result.data.user.last_name, "Lim");
    assert.equal(result.data.user.username, "bryanlim");
    assert.equal(result.data.authDate, now);
  }
});

test("validateTelegramInitData rejects tampered hash", () => {
  const now = Math.floor(Date.now() / 1000);
  const rawInitData = buildTestInitData(
    {
      auth_date: String(now),
      user: JSON.stringify({ id: 12345, first_name: "Tamper" }),
    },
    TEST_BOT_TOKEN
  );

  // Tamper hash by replacing last characters
  const searchParams = new URLSearchParams(rawInitData);
  const originalHash = searchParams.get("hash")!;
  const tamperedHash =
    originalHash.slice(0, -4) + (originalHash.endsWith("0000") ? "1111" : "0000");
  searchParams.set("hash", tamperedHash);

  const result = validateTelegramInitData(searchParams.toString(), TEST_BOT_TOKEN);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "invalid_signature");
  }
});

test("validateTelegramInitData rejects tampered payload with unmodified hash", () => {
  const now = Math.floor(Date.now() / 1000);
  const rawInitData = buildTestInitData(
    {
      auth_date: String(now),
      user: JSON.stringify({ id: 12345, first_name: "Original" }),
    },
    TEST_BOT_TOKEN
  );

  // Tamper with user parameter while keeping old hash
  const searchParams = new URLSearchParams(rawInitData);
  searchParams.set(
    "user",
    JSON.stringify({ id: 99999, first_name: "Attacker" })
  );

  const result = validateTelegramInitData(searchParams.toString(), TEST_BOT_TOKEN);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "invalid_signature");
  }
});

test("validateTelegramInitData rejects stale auth_date (> 24h old)", () => {
  const now = Math.floor(Date.now() / 1000);
  const staleAuthDate = now - 25 * 3600; // 25 hours ago

  const rawInitData = buildTestInitData(
    {
      auth_date: String(staleAuthDate),
      user: JSON.stringify({ id: 12345, first_name: "StaleUser" }),
    },
    TEST_BOT_TOKEN
  );

  const result = validateTelegramInitData(rawInitData, TEST_BOT_TOKEN, {
    nowUnix: now,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error, "stale_auth_date");
  }
});

test("validateTelegramInitData accepts auth_date within 24h window", () => {
  const now = Math.floor(Date.now() / 1000);
  const validAuthDate = now - 23 * 3600; // 23 hours ago (< 24h)

  const rawInitData = buildTestInitData(
    {
      auth_date: String(validAuthDate),
      user: JSON.stringify({ id: 12345, first_name: "RecentUser" }),
    },
    TEST_BOT_TOKEN
  );

  const result = validateTelegramInitData(rawInitData, TEST_BOT_TOKEN, {
    nowUnix: now,
  });
  assert.equal(result.ok, true);
});

test("validateTelegramInitData rejects missing hash, auth_date, or user", () => {
  const now = Math.floor(Date.now() / 1000);

  // Missing hash
  const noHash = new URLSearchParams({
    auth_date: String(now),
    user: JSON.stringify({ id: 1, first_name: "A" }),
  }).toString();
  assert.equal(validateTelegramInitData(noHash, TEST_BOT_TOKEN).ok, false);

  // Missing auth_date (with signature over that payload)
  const noAuthDate = buildTestInitData(
    { user: JSON.stringify({ id: 1, first_name: "A" }) },
    TEST_BOT_TOKEN
  );
  assert.equal(validateTelegramInitData(noAuthDate, TEST_BOT_TOKEN).ok, false);

  // Missing user (with signature over that payload)
  const noUser = buildTestInitData(
    { auth_date: String(now) },
    TEST_BOT_TOKEN
  );
  assert.equal(validateTelegramInitData(noUser, TEST_BOT_TOKEN).ok, false);
});
