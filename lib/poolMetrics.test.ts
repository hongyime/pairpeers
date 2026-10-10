import test from "node:test";
import assert from "node:assert/strict";
import { computePoolMetrics, type ParticipantInfo } from "./poolMetrics.ts";

test("empty pool returns zero counts and no erroneous warnings", () => {
  const metrics = computePoolMetrics([]);
  assert.equal(metrics.totalParticipants, 0);
  assert.equal(metrics.eligiblePoolSize, 0);
  assert.equal(metrics.excludedCount, 0);
  assert.equal(metrics.eligiblePairCount, 0);
  assert.equal(metrics.pairRatio, 0);
  assert.equal(metrics.warnings.length, 0);
});

test("skewed pool warns when single identity bucket exceeds 70%", () => {
  // 8 men, 2 women = 80% men (exceeds 70% threshold)
  const participants: ParticipantInfo[] = [
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `m_${i}`,
      answers: { identity: "man", seeking: "everyone" },
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `w_${i}`,
      answers: { identity: "woman", seeking: "everyone" },
    })),
  ];

  const metrics = computePoolMetrics(participants);
  assert.equal(metrics.eligiblePoolSize, 10);
  assert.equal(metrics.identityBuckets["man"], 8);
  assert.equal(metrics.identityShares["man"], 0.8);
  assert.equal(metrics.maxIdentityShare, 0.8);
  assert.equal(metrics.dominantIdentityBucket, "man");
  assert.ok(metrics.warnings.some((w) => w.includes("Identity skew detected: man represents 80%")));
});

test("non-binary balanced pool calculates buckets and produces no skew alert", () => {
  const participants: ParticipantInfo[] = [
    { id: "nb1", answers: { identity: "nonbinary", seeking: "everyone" } },
    { id: "nb2", answers: { identity: "nonbinary", seeking: "everyone" } },
    { id: "p1", answers: { identity: "prefer_not", seeking: "everyone" } },
    { id: "w1", answers: { identity: "woman", seeking: "everyone" } },
    { id: "m1", answers: { identity: "man", seeking: "everyone" } },
  ];

  const metrics = computePoolMetrics(participants);
  assert.equal(metrics.eligiblePoolSize, 5);
  assert.equal(metrics.identityBuckets["nonbinary"], 2);
  assert.equal(metrics.identityBuckets["prefer_not"], 1);
  assert.equal(metrics.identityBuckets["woman"], 1);
  assert.equal(metrics.identityBuckets["man"], 1);
  // Max share is 2/5 = 40% (well below 70%)
  assert.equal(metrics.maxIdentityShare, 0.4);
  assert.ok(!metrics.warnings.some((w) => w.includes("Identity skew")));
  // All 5 participants seek everyone -> 10 eligible pairs; pairRatio = 10 / 5 = 2.0 (above 0.5)
  assert.equal(metrics.eligiblePairCount, 10);
  assert.equal(metrics.pairRatio, 2);
});

test("warns when eligible-pair ratio drops below 50% of participants", () => {
  // 4 participants where seeking preferences produce 0 or very few eligible pairs
  // e.g. 4 men all seeking women -> 0 eligible pairs between each other!
  const participants: ParticipantInfo[] = [
    { id: "m1", answers: { identity: "man", seeking: "women" } },
    { id: "m2", answers: { identity: "man", seeking: "women" } },
    { id: "m3", answers: { identity: "man", seeking: "women" } },
    { id: "m4", answers: { identity: "man", seeking: "women" } },
  ];

  const metrics = computePoolMetrics(participants);
  assert.equal(metrics.eligiblePairCount, 0);
  assert.equal(metrics.pairRatio, 0);
  assert.ok(metrics.warnings.some((w) => w.includes("Low eligible-pair ratio")));
});

test("properly counts and distinguishes excluded members", () => {
  const participants: ParticipantInfo[] = [
    { id: "p1", answers: { identity: "man", seeking: "everyone" } },
    { id: "p2", isExcluded: true, exclusionReason: "banned" },
    { id: "p3", isExcluded: true, exclusionReason: "incomplete" },
  ];

  const metrics = computePoolMetrics(participants);
  assert.equal(metrics.totalParticipants, 3);
  assert.equal(metrics.eligiblePoolSize, 1);
  assert.equal(metrics.excludedCount, 2);
});

test("warning copy contains zero em dashes", () => {
  const participants: ParticipantInfo[] = [
    { id: "m1", answers: { identity: "man", seeking: "women" } },
    { id: "m2", answers: { identity: "man", seeking: "women" } },
  ];
  const metrics = computePoolMetrics(participants);
  for (const w of metrics.warnings) {
    assert.ok(!w.includes("—"), `Warning should not contain em dash: ${w}`);
  }
});
