import { SafetyQueue } from "./SafetyQueue";

export const metadata = { title: "Safety Operations · PairPeers Admin" };

export default function SafetyPage() {
  return (
    <main>
      <div style={{ marginBottom: "1.5rem" }}>
        <div className="eyebrow">Admin</div>
        <h1>Safety Operations</h1>
      </div>
      <SafetyQueue />
    </main>
  );
}
