"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Telegram?: {
      Login: {
        auth(
          options: {
            client_id: number;
            scope?: Array<"profile" | "phone" | "write">;
            lang?: string;
            nonce?: string;
          },
          callback: (data: {
            id_token?: string;
            user?: Record<string, unknown>;
            error?: string;
          }) => void
        ): void;
      };
    };
  }
}

const LIB_URL = "https://oauth.telegram.org/js/telegram-login.js";

/** In-app browsers (Telegram/IG/TikTok/…) and iOS standalone PWAs where popups are unreliable. */
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (
    /Telegram|Instagram|FBAN|FBAV|Line\/|MicroMessenger|Twitter|Snapchat|TikTok|Pinterest|Reddit/i.test(
      ua
    )
  ) {
    return true;
  }
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function loadLibrary(): Promise<void> {
  if (window.Telegram?.Login) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LIB_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("failed to load Telegram login library"));
    document.head.appendChild(script);
  });
}

/**
 * "Log in with Telegram" via the current OIDC popup flow
 * (https://core.telegram.org/bots/telegram-login).
 *
 * The button is site-styled HTML — Telegram's legacy blue iframe widget is
 * deprecated and cannot be restyled. The popup returns a signed id_token JWT,
 * which we POST to /api/auth/telegram for server-side verification.
 *
 * In in-app browsers / installed PWAs the popup is unreliable, so those
 * users get the redirect flow (plain navigation) as the primary path.
 *
 * NOTE: the popup flow breaks if the site serves
 * `Cross-Origin-Opener-Policy: same-origin`; use
 * `same-origin-allow-popups` or omit the header.
 */
export default function TelegramLogin({
  redirectTo = "/questionnaire",
}: {
  redirectTo?: string;
}) {
  const clientId = process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID;
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [inApp, setInApp] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  const redirectHref = `/api/auth/telegram/redirect?next=${encodeURIComponent(redirectTo)}`;

  const login = useCallback(async () => {
    if (busyRef.current || !clientId) return;
    busyRef.current = true;
    setStatus("busy");
    setError(null);
    try {
      // 1. Get a server-issued nonce (replay protection, bound to this browser).
      const nonceRes = await fetch("/api/auth/telegram/nonce");
      if (!nonceRes.ok) throw new Error("could not start login");
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      // 2. Open the Telegram popup.
      await loadLibrary();
      const data = await new Promise<{
        id_token?: string;
        error?: string;
      }>((resolve) => {
        window.Telegram!.Login.auth(
          { client_id: Number(clientId), scope: ["profile"], nonce },
          (d) => resolve(d)
        );
      });
      if (data.error || !data.id_token) {
        throw new Error(data.error || "login was cancelled");
      }

      // 3. Verify the id_token server-side and establish the session.
      const verifyRes = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id_token: data.id_token }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => null)) as {
          error?: string;
          reason?: string;
        } | null;
        throw new Error(
          body?.reason ? `${body.error} (${body.reason})` : body?.error || "verification failed"
        );
      }

      window.location.href = redirectTo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
      setStatus("error");
      busyRef.current = false;
    }
  }, [clientId, redirectTo]);

  if (!clientId) {
    return (
      <p className="muted small">
        Telegram login is not configured yet. Set{" "}
        <code>NEXT_PUBLIC_TELEGRAM_CLIENT_ID</code> in your environment.
      </p>
    );
  }

  // In-app browsers / installed PWAs: popups are unreliable — redirect first.
  if (inApp) {
    return (
      <div>
        <a className="btn" href={redirectHref}>
          Continue with Telegram
        </a>
        <p className="muted small">
          <button type="button" className="link-btn" onClick={login}>
            Try the popup instead
          </button>
        </p>
        {status === "error" && error && (
          <p className="status" role="alert">
            Login failed: {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="btn" onClick={login} disabled={status === "busy"}>
        {status === "busy" ? "Opening Telegram…" : "Log in with Telegram"}
      </button>
      {status === "error" && error && (
        <p className="status" role="alert">
          Login failed: {error}
        </p>
      )}
    </div>
  );
}
