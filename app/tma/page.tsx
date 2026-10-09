"use client";

import { useEffect, useState, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";

interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  [key: string]: string | undefined;
}

interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    query_id?: string;
    user?: TelegramWebAppUser;
    auth_date?: string;
    hash?: string;
    start_param?: string;
    [key: string]: unknown;
  };
  version?: string;
  platform?: string;
  colorScheme?: "light" | "dark";
  themeParams?: TelegramThemeParams;
  ready: () => void;
  expand: () => void;
  close?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

function getTelegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as unknown as {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  };
  return win.Telegram?.WebApp;
}

type AuthState =
  | { status: "checking" }
  | { status: "not_telegram" }
  | { status: "loading" }
  | { status: "authenticated"; name: string; username?: string | null }
  | { status: "failed"; error: string };

export default function TelegramMiniAppPage() {
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" });

  const authenticateWithTelegram = useCallback(async (webApp: TelegramWebApp) => {
    // 1. Signal ready to the Telegram client
    webApp.ready();

    // 2. Expand viewport to full height
    webApp.expand();

    // 3. Apply themeParams (bg_color -> body background, header_bg_color via setHeaderColor)
    const theme = webApp.themeParams;
    if (theme?.bg_color) {
      document.body.style.backgroundColor = theme.bg_color;
    }
    if (typeof webApp.setHeaderColor === "function") {
      try {
        const headerColor = theme?.header_bg_color || theme?.bg_color;
        if (headerColor) {
          webApp.setHeaderColor(headerColor);
        }
      } catch {
        // Some Telegram clients restrict header color calls; ignore safely
      }
    }

    setAuthState({ status: "loading" });

    // 4. POST initData to /api/auth/telegram/miniapp
    try {
      const res = await fetch("/api/auth/telegram/miniapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: webApp.initData }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAuthState({
          status: "failed",
          error: data.error || `Authentication failed (HTTP ${res.status})`,
        });
        return;
      }

      // Resolved display name from server or initData
      const displayName =
        data.user?.name ||
        [webApp.initDataUnsafe?.user?.first_name, webApp.initDataUnsafe?.user?.last_name]
          .filter(Boolean)
          .join(" ") ||
        webApp.initDataUnsafe?.user?.username ||
        "Member";

      setAuthState({
        status: "authenticated",
        name: displayName,
        username: data.user?.username || webApp.initDataUnsafe?.user?.username,
      });
    } catch {
      setAuthState({
        status: "failed",
        error: "Network error connecting to auth service. Please check your connection.",
      });
    }
  }, []);

  const evaluateTelegramEnvironment = useCallback(() => {
    const webApp = getTelegramWebApp();
    if (webApp && webApp.initData && webApp.initData.length > 0) {
      authenticateWithTelegram(webApp);
    } else {
      // When opened in standard browser or missing initData
      setAuthState({ status: "not_telegram" });
    }
  }, [authenticateWithTelegram]);

  useEffect(() => {
    // Initial check on mount
    const webApp = getTelegramWebApp();
    if (webApp && webApp.initData && webApp.initData.length > 0) {
      authenticateWithTelegram(webApp);
      return;
    }

    // Give script a moment to load if not instantly available
    const timer = setTimeout(() => {
      evaluateTelegramEnvironment();
    }, 750);

    return () => clearTimeout(timer);
  }, [authenticateWithTelegram, evaluateTelegramEnvironment]);

  const handleRetry = () => {
    const webApp = getTelegramWebApp();
    if (webApp && webApp.initData) {
      authenticateWithTelegram(webApp);
    } else {
      evaluateTelegramEnvironment();
    }
  };

  return (
    <>
      {/* Load Telegram WebApp JS script */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={evaluateTelegramEnvironment}
      />

      <main className="centered">
        <div className="card narrow">
          <div className="login-card">
            <span className="eyebrow">PairPeers Mini App</span>

            {authState.status === "checking" && (
              <div style={{ marginTop: "24px" }}>
                <p className="status-line">Connecting to Telegram...</p>
              </div>
            )}

            {authState.status === "not_telegram" && (
              <div style={{ marginTop: "24px" }}>
                <h1>Open in Telegram</h1>
                <p style={{ marginTop: "12px", marginBottom: "24px" }}>
                  Open this page inside Telegram to access the PairPeers Mini App.
                </p>
                <div className="actions" style={{ justifyContent: "center" }}>
                  <a
                    href="https://t.me/pairpeersbot"
                    className="btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open @pairpeersbot
                  </a>
                  <Link href="/" className="btn secondary">
                    Back to website
                  </Link>
                </div>
              </div>
            )}

            {authState.status === "loading" && (
              <div style={{ marginTop: "24px" }}>
                <h1>Signing in...</h1>
                <p className="status-line" style={{ marginTop: "16px" }}>
                  Verifying your Telegram identity with PairPeers.
                </p>
              </div>
            )}

            {authState.status === "authenticated" && (
              <div style={{ marginTop: "24px" }}>
                <h1>Signed in as {authState.name}</h1>
                {authState.username && (
                  <p className="muted small" style={{ marginTop: "6px" }}>
                    @{authState.username}
                  </p>
                )}
                <p style={{ marginTop: "16px", marginBottom: "28px" }}>
                  Your session is ready. You can now complete your questionnaire or manage invites.
                </p>
                <div
                  className="actions"
                  style={{ justifyContent: "center", display: "flex", flexDirection: "column", gap: "10px" }}
                >
                  <Link href="/questionnaire" className="btn">
                    Continue to Questionnaire
                  </Link>
                  <Link href="/invites" className="btn secondary">
                    View Your Invites
                  </Link>
                </div>
              </div>
            )}

            {authState.status === "failed" && (
              <div style={{ marginTop: "24px" }}>
                <h1>Authentication Failed</h1>
                <p style={{ marginTop: "12px", marginBottom: "24px", color: "var(--primary)" }}>
                  {authState.error}
                </p>
                <div className="actions" style={{ justifyContent: "center" }}>
                  <button type="button" onClick={handleRetry} className="btn">
                    Retry
                  </button>
                  <Link href="/" className="btn secondary">
                    Return to Home
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
