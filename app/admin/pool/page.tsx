import { PoolMonitor } from "./PoolMonitor";

export const metadata = { title: "Pool Monitor · PairPeers Admin" };

export default function PoolPage() {
  return (
    <main>
      <div style={{ marginBottom: "1.5rem" }}>
        <div className="eyebrow">Admin</div>
        <h1>Pool Balance Monitor</h1>
      </div>
      <PoolMonitor />
    </main>
  );
}
