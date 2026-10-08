import Link from "next/link";
import TelegramLogin from "@/components/TelegramLogin";

export default function LoginPage() {
  return (
    <main className="centered">
      <div className="card narrow">
        <div className="eyebrow">PairPeers</div>
        <h1>Sign in</h1>
        <p className="muted">
          One account, no passwords. We use Telegram to verify you&apos;re a real
          person — free, fast, and no app review queues.
        </p>
        <div className="widget-wrap">
          <TelegramLogin />
        </div>
        <p className="muted small">
          <Link href="/">← Back home</Link>
        </p>
      </div>
    </main>
  );
}
