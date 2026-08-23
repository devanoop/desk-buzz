import { describe, it, expect, beforeAll } from "vitest";
import {
  aggregateObservations,
  percentile,
  deriveConfidence,
  MIN_SAMPLE_SIZE,
} from "../aggregate";
import {
  loadOnetOccupations,
  OccupationNormalizer,
} from "../occupation-normalizer";
import type { RawObservation } from "../types";

describe("percentile()", () => {
  it("computes the median of an odd-length array", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("interpolates the median of an even-length array", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("returns the single value for a one-element array at any percentile", () => {
    expect(percentile([42], 0.1)).toBe(42);
    expect(percentile([42], 0.9)).toBe(42);
  });

  it("returns the min/max at p0/p100", () => {
    const sorted = [10, 20, 30, 40, 50];
    expect(percentile(sorted, 0)).toBe(10);
    expect(percentile(sorted, 1)).toBe(50);
  });

  it("throws on an empty array rather than returning a fabricated 0", () => {
    expect(() => percentile([], 0.5)).toThrow();
  });
});

describe("deriveConfidence()", () => {
  it("is low below the medium threshold", () => {
    expect(deriveConfidence(3)).toBe("low");
    expect(deriveConfidence(9)).toBe("low");
  });
  it("is medium between thresholds", () => {
    expect(deriveConfidence(10)).toBe("medium");
    expect(deriveConfidence(29)).toBe("medium");
  });
  it("is high at/above the high threshold", () => {
    expect(deriveConfidence(30)).toBe("high");
    expect(deriveConfidence(1000)).toBe("high");
  });
});

describe("aggregateObservations()", () => {
  let normalizer: OccupationNormalizer;

  beforeAll(() => {
    const records = loadOnetOccupations(
      "data/onet/occupation_data.csv",
      "data/onet/sample_of_reported_titles.csv",
    );
    normalizer = new OccupationNormalizer(records);
  });

  const makeObs = (
    payAnnual: number,
    overrides: Partial<RawObservation> = {},
  ): RawObservation => ({
    occupationTitleRaw: "Software Developers",
    occupationSocCodeHint: "15-1252.00",
    employerName: "Acme Corp",
    country: "US",
    region: "CA",
    city: "San Francisco",
    payAnnual,
    payCurrency: "USD",
    ...overrides,
  });

  it("suppresses a group below MIN_SAMPLE_SIZE instead of publishing a shaky distribution", () => {
    const obs = Array.from({ length: MIN_SAMPLE_SIZE - 1 }, () =>
      makeObs(100_000),
    );
    const { points, stats } = aggregateObservations(obs, normalizer);
    expect(points).toHaveLength(0);
    expect(stats.groupsSuppressed).toBe(1);
  });

  it("publishes a full p10..p90 distribution once a group reaches MIN_SAMPLE_SIZE", () => {
    const obs = Array.from({ length: MIN_SAMPLE_SIZE }, (_, i) =>
      makeObs(100_000 + i * 1000),
    );
    const { points } = aggregateObservations(obs, normalizer);
    expect(points).toHaveLength(5); // p10,p25,p50,p75,p90
    const percentiles = points.map((p) => p.percentile).sort();
    expect(percentiles).toEqual(["p10", "p25", "p50", "p75", "p90"]);
    for (const p of points) {
      expect(p.sampleSize).toBe(MIN_SAMPLE_SIZE);
      expect(p.occupationSocCode).toBe("15-1252.00");
    }
  });

  it("never blends two different employers into one group", () => {
    const obsA = Array.from({ length: 5 }, () =>
      makeObs(100_000, { employerName: "Acme Corp" }),
    );
    const obsB = Array.from({ length: 5 }, () =>
      makeObs(200_000, { employerName: "Globex Inc" }),
    );
    const { points } = aggregateObservations([...obsA, ...obsB], normalizer);
    const employers = new Set(points.map((p) => p.employerName));
    expect(employers).toEqual(new Set(["Acme Corp", "Globex Inc"]));
    // Each employer's own group should reflect only its own values.
    const acmeMedian = points.find(
      (p) => p.employerName === "Acme Corp" && p.percentile === "p50",
    )!;
    expect(acmeMedian.payAmount).toBe(100_000);
  });

  it("never blends two different geographies into one group", () => {
    const obsCA = Array.from({ length: 5 }, () =>
      makeObs(150_000, { region: "CA", employerName: null }),
    );
    const obsNY = Array.from({ length: 5 }, () =>
      makeObs(150_000, { region: "NY", employerName: null }),
    );
    const { points } = aggregateObservations([...obsCA, ...obsNY], normalizer);
    const regions = new Set(points.map((p) => p.region));
    expect(regions).toEqual(new Set(["CA", "NY"]));
  });

  it("never blends two different currencies into one group", () => {
    const obsUsd = Array.from({ length: 5 }, () =>
      makeObs(100_000, { payCurrency: "USD", employerName: null }),
    );
    const obsGbp = Array.from({ length: 5 }, () =>
      makeObs(80_000, { payCurrency: "GBP", employerName: null }),
    );
    const { points } = aggregateObservations(
      [...obsUsd, ...obsGbp],
      normalizer,
    );
    const currencies = new Set(points.map((p) => p.payCurrency));
    expect(currencies).toEqual(new Set(["USD", "GBP"]));
  });

  it("skips observations whose occupation can't be normalized, without fabricating a match", () => {
    const obs = Array.from({ length: 5 }, () =>
      makeObs(100_000, {
        occupationSocCodeHint: null,
        occupationTitleRaw: "Xyzzy Plugh Frotz",
      }),
    );
    const { points, stats } = aggregateObservations(obs, normalizer);
    expect(points).toHaveLength(0);
    expect(stats.observationsSkippedNoOccupation).toBe(5);
  });
});
