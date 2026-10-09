"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";

type ThemeParams = Record<string, string | undefined>;
export type TelegramWebApp = {
  initData: string;
  themeParams?: ThemeParams;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  MainButton?: { setText: (text: string) => void; show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  HapticFeedback?: { impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void; notificationOccurred: (type: "error" | "success" | "warning") => void };
};

type TmaState = { status: "checking" | "loading" | "not_telegram" | "failed" | "authenticated"; error?: string };
type TmaContextValue = { webApp?: TelegramWebApp; haptic: (kind?: "light" | "success" | "error") => void };
const TmaContext = createContext<TmaContextValue>({ haptic: () => undefined });

function getWebApp(): TelegramWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as typeof window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

function applyTheme(webApp: TelegramWebApp) {
  const theme = webApp.themeParams ?? {};
  const mappings: Record<string, string> = { bg_color: "--tma-bg", text_color: "--tma-text", hint_color: "--tma-hint", link_color: "--tma-link", button_color: "--tma-button", button_text_color: "--tma-button-text", secondary_bg_color: "--tma-secondary-bg" };
  for (const [source, target] of Object.entries(mappings)) if (theme[source]) document.documentElement.style.setProperty(target, theme[source]!);
  if (theme.bg_color) document.body.style.backgroundColor = theme.bg_color;
  if (theme.text_color) document.body.style.color = theme.text_color;
  try {
    const header = theme.header_bg_color ?? theme.bg_color;
    if (header) webApp.setHeaderColor?.(header);
    if (theme.bg_color) webApp.setBackgroundColor?.(theme.bg_color);
  } catch { /* older Telegram clients may reject these calls */ }
}

export function useTma() { return useContext(TmaContext); }

export function TmaShell({ children, title, home = false }: { children: React.ReactNode; title: string; home?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<TmaState>({ status: "checking" });
  const [webApp, setWebApp] = useState<TelegramWebApp>();

  const authenticate = useCallback(async (app: TelegramWebApp) => {
    app.ready(); app.expand(); applyTheme(app); setWebApp(app); setState({ status: "loading" });
    try {
      const response = await fetch("/api/auth/telegram/miniapp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: app.initData }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) { setState({ status: "failed", error: data.error ?? "Authentication failed." }); return; }
      setState({ status: "authenticated" });
    } catch { setState({ status: "failed", error: "Network error connecting to Telegram." }); }
  }, []);
  const check = useCallback(() => { const app = getWebApp(); if (app?.initData) authenticate(app); else setState({ status: "not_telegram" }); }, [authenticate]);

  useEffect(() => {
    const app = getWebApp();
    if (app?.initData) authenticate(app);
    else { const timer = window.setTimeout(check, 750); return () => window.clearTimeout(timer); }
  }, [authenticate, check]);

  useEffect(() => {
    const back = webApp?.BackButton;
    if (!back) return;
    const onBack = () => router.push(home ? "/tma" : "/tma");
    if (home) back.hide(); else { back.show(); back.onClick(onBack); }
    return () => { if (!home) back.offClick(onBack); };
  }, [home, pathname, router, webApp]);

  const context = useMemo<TmaContextValue>(() => ({ webApp, haptic: (kind = "light") => { try { if (kind === "success" || kind === "error") webApp?.HapticFeedback?.notificationOccurred(kind); else webApp?.HapticFeedback?.impactOccurred(kind); } catch { /* best effort */ } } }), [webApp]);
  return <TmaContext.Provider value={context}>
    <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onLoad={check} />
    <main className="centered tma-page"><div className="card narrow"><div className="login-card">
      {state.status === "checking" || state.status === "loading" ? <><h1>{title}</h1><p className="status-line">{state.status === "loading" ? "Signing you in…" : "Connecting to Telegram…"}</p></> : null}
      {state.status === "not_telegram" ? <><h1>Open in Telegram</h1><p>Open this page inside Telegram to use PairPeers.</p><a className="btn" href="https://t.me/pairpeersbot" target="_blank" rel="noreferrer">Open @pairpeersbot</a></> : null}
      {state.status === "failed" ? <><h1>Couldn’t sign you in</h1><p className="status" role="alert">{state.error}</p><button className="btn" type="button" onClick={() => { const app = getWebApp(); if (app) authenticate(app); else check(); }}>Try again</button></> : null}
      {state.status === "authenticated" ? <><h1>{title}</h1>{children}</> : null}
    </div></div></main>
  </TmaContext.Provider>;
}
