"use client";

import { useEffect, useRef } from "react";

/**
 * Renders the official Telegram Login widget.
 * On success Telegram redirects the browser to /api/auth/telegram
 * with the signed user payload as query params.
 */
export default function TelegramLogin() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME;
    const el = containerRef.current;
    if (!el || !botName) return;
    if (el.hasChildNodes()) return; // don't double-inject on re-renders

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", "/api/auth/telegram");
    script.setAttribute("data-request-access", "write");
    el.appendChild(script);
  }, []);

  if (!process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME) {
    return (
      <p style={{ opacity: 0.7 }}>
        Telegram login is not configured yet. Set{" "}
        <code>NEXT_PUBLIC_TELEGRAM_BOT_NAME</code> in your environment.
      </p>
    );
  }

  return <div ref={containerRef} />;
}
