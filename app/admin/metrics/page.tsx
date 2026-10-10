import { MetricsDashboard } from "./MetricsDashboard";

export const metadata = { title: "Metrics · PairPeers Admin" };

export default function MetricsPage() {
  return (
    <main>
      <div style={{ marginBottom: "1.5rem" }}>
        <div className="eyebrow">Admin</div>
        <h1>Founder Metrics Dashboard</h1>
      </div>
      <MetricsDashboard />
    </main>
  );
}
