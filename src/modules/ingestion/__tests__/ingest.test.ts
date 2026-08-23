import { describe, it, expect } from "vitest";
import { computeDedupeKey } from "../ingest";
import type { BenchmarkPoint } from "../types";

// Only the pure dedupe-key logic is unit-tested here — ensureDataSource,
// upsertOccupations, ingestBenchmarkPoints, and runAndIngest all require a
// live Postgres connection (DATABASE_URL) and are integration-tested
// against a real database, not part of this suite. See the Phase 2 summary
// for how to run that verification once a database is available.

const basePoint: BenchmarkPoint = {
  occupationSocCode: "15-1252.00",
  occupationTitleRaw: "Software Developers",
  employerName: "Acme Corp",
  country: "US",
  region: "CA",
  city: "San Francisco",
  percentile: "p50",
  payAmount: 135000,
  payCurrency: "USD",
  sampleSize: 42,
  confidence: "high",
};

describe("computeDedupeKey", () => {
  it("is deterministic for the same inputs", () => {
    const a = computeDedupeKey("bls-oews", basePoint);
    const b = computeDedupeKey("bls-oews", basePoint);
    expect(a).toBe(b);
  });

  it("differs when the source changes", () => {
    expect(computeDedupeKey("bls-oews", basePoint)).not.toBe(
      computeDedupeKey("dol-lca", basePoint),
    );
  });

  it("differs when the percentile changes", () => {
    const p90 = { ...basePoint, percentile: "p90" as const };
    expect(computeDedupeKey("bls-oews", basePoint)).not.toBe(
      computeDedupeKey("bls-oews", p90),
    );
  });

  it("differs when geography changes", () => {
    const ny = { ...basePoint, region: "NY", city: "New York" };
    expect(computeDedupeKey("bls-oews", basePoint)).not.toBe(
      computeDedupeKey("bls-oews", ny),
    );
  });

  it("is unaffected by payAmount — the key identifies the observation, not its value", () => {
    // This matters for idempotency: re-ingesting the same (source, geo,
    // occupation, employer, percentile) slot with a revised figure should
    // update the existing row, not create a new one.
    const revised = { ...basePoint, payAmount: 999_999 };
    expect(computeDedupeKey("bls-oews", basePoint)).toBe(
      computeDedupeKey("bls-oews", revised),
    );
  });

  it("treats employer name case-insensitively", () => {
    const upper = { ...basePoint, employerName: "ACME CORP" };
    expect(computeDedupeKey("bls-oews", basePoint)).toBe(
      computeDedupeKey("bls-oews", upper),
    );
  });

  it("distinguishes a null employer from a named one (occupation-only vs employer-specific)", () => {
    const noEmployer = { ...basePoint, employerName: null };
    expect(computeDedupeKey("bls-oews", basePoint)).not.toBe(
      computeDedupeKey("bls-oews", noEmployer),
    );
  });
});
