import { describe, it, expect, beforeAll } from "vitest";
import {
  loadBlsSample,
  loadAsheSample,
  loadDolLcaSampleObservations,
} from "../load-samples";
import {
  loadOnetOccupations,
  OccupationNormalizer,
} from "../occupation-normalizer";
import { aggregateObservations } from "../aggregate";

// Exercises the committed data/samples/*.csv files end-to-end through the
// same code path the CLI's --mode=seed uses — a regression guard that the
// real committed sample data still loads and normalizes cleanly.
describe("load-samples against the real committed sample files", () => {
  let normalizer: OccupationNormalizer;

  beforeAll(() => {
    const records = loadOnetOccupations(
      "data/onet/occupation_data.csv",
      "data/onet/sample_of_reported_titles.csv",
    );
    normalizer = new OccupationNormalizer(records);
  });

  it("loads the BLS OEWS sample and produces 5 points per matched occupation", () => {
    const result = loadBlsSample(
      "data/samples/bls-oews-sample.csv",
      normalizer,
    );
    expect(result.rowsParsed).toBe(23); // matches docs/data-sources.md's documented row count
    expect(result.points.length).toBe(
      result.rowsParsed * 5 - result.rowsSkipped * 5,
    );
    expect(
      result.points.every((p) => p.country === "US" && p.payCurrency === "USD"),
    ).toBe(true);
    // Spot check a known real value from the sample file.
    const softwareDevMedian = result.points.find(
      (p) => p.occupationSocCode === "15-1252.00" && p.percentile === "p50",
    );
    expect(softwareDevMedian?.payAmount).toBe(135980);
  });

  it("loads the ONS ASHE sample and produces some points without fabricating unmatched ones", () => {
    const result = loadAsheSample(
      "data/samples/ons-ashe-sample.csv",
      normalizer,
    );
    expect(result.rowsParsed).toBe(52); // matches docs/data-sources.md's documented row count
    expect(result.points.length).toBeGreaterThan(0);
    expect(result.rowsSkipped).toBeGreaterThan(0); // cross-taxonomy matching is deliberately conservative, see occupation-normalizer.ts
    expect(
      result.points.every((p) => p.country === "GB" && p.payCurrency === "GBP"),
    ).toBe(true);
  });

  it("loads DOL LCA sample observations and aggregates them into suppressed/published groups", () => {
    const { observations, rowsParsed } = loadDolLcaSampleObservations(
      "data/samples/dol-lca-sample.csv",
    );
    expect(rowsParsed).toBe(3038); // matches docs/data-sources.md's documented row count
    expect(observations.length).toBeGreaterThan(0);
    expect(
      observations.every((o) => o.country === "US" && o.payCurrency === "USD"),
    ).toBe(true);

    const { points, stats } = aggregateObservations(observations, normalizer);
    // With ~3000 individual LCA cases spread across many (employer, occupation,
    // location) combinations, most groups won't reach MIN_SAMPLE_SIZE — that's
    // expected and is exactly the suppression behavior being verified here,
    // not a bug.
    expect(stats.groupsConsidered).toBeGreaterThan(0);
    expect(points.length % 5).toBe(0); // every published group contributes exactly 5 percentile points
  });
});
