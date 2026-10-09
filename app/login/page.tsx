import Link from "next/link";
import TelegramLogin from "@/components/TelegramLogin";
import LoginErrorNote from "./error-note";

export default function LoginPage() {
  return (
    <main className="centered">
      <div className="card narrow login-card">
        <div className="eyebrow">PairPeers</div>
        <h1>Sign in</h1>
        <LoginErrorNote />
        <div className="widget-wrap">
          <TelegramLogin />
        </div>
        <p className="muted small">
          Popup blocked or on an in-app browser?{" "}
          <a href="/api/auth/telegram/redirect">Sign in via redirect instead</a>.
        </p>
        <p className="muted">Telegram verifies you&apos;re a real person. We never see your chats.</p>
        <p className="muted small">
          <Link href="/">← Back home</Link>
        </p>
      </div>
    </main>
  );
}
