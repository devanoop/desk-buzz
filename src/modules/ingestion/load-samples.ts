import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import type {
  AdapterRunResult,
  BenchmarkPoint,
  Percentile,
  RawObservation,
} from "./types";
import { PERCENTILES } from "./types";
import type { OccupationNormalizer } from "./occupation-normalizer";

/**
 * Loaders for the committed data/samples/*.csv files (see
 * docs/data-sources.md) — the "first deploy is useful immediately" path,
 * as opposed to the full live-source adapters in adapters/*.ts. Every row
 * in every sample file is real data (see the data-sources doc for exactly
 * how each was pulled); these loaders just reshape the already-flattened
 * CSVs back into the same BenchmarkPoint/RawObservation shapes the real
 * adapters produce, so the ingestion pipeline downstream doesn't care
 * whether a point came from a live fetch or the committed sample.
 */

interface BlsSampleRow {
  soc_code: string;
  occupation_title: string;
  year: string;
  p10: string;
  p25: string;
  p50: string;
  p75: string;
  p90: string;
}

export function loadBlsSample(
  csvPath: string,
  normalizer: OccupationNormalizer,
): AdapterRunResult {
  const rows = parse(readFileSync(csvPath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
  }) as BlsSampleRow[];
  const points: BenchmarkPoint[] = [];
  let rowsSkipped = 0;
  const skipReasons: Record<string, number> = {};

  for (const row of rows) {
    const match =
      normalizer.bySocCode(`${row.soc_code}.00`) ??
      normalizer.normalize(row.occupation_title);
    if (!match) {
      rowsSkipped++;
      skipReasons["occupation-not-in-taxonomy"] =
        (skipReasons["occupation-not-in-taxonomy"] ?? 0) + 1;
      continue;
    }
    for (const pct of PERCENTILES) {
      points.push({
        occupationSocCode: match.socCode,
        occupationTitleRaw: row.occupation_title,
        employerName: null,
        country: "US",
        region: null,
        city: null,
        percentile: pct,
        payAmount: Number(row[pct]),
        payCurrency: "USD",
        sampleSize: null, // this sample's API source didn't include employment counts
        confidence: "medium",
      });
    }
  }

  return {
    sourceKey: "bls-oews",
    sourceUrl:
      "https://api.bls.gov/publicAPI/v2/timeseries/data/ (sample — see docs/data-sources.md)",
    points,
    rowsParsed: rows.length,
    rowsSkipped,
    skipReasons,
  };
}

interface AsheSampleRow {
  soc_code: string;
  title: string;
  sample_size_thousands: string;
  p10: string;
  p25: string;
  p50: string;
  p75: string;
  p90: string;
}

export function loadAsheSample(
  csvPath: string,
  normalizer: OccupationNormalizer,
): AdapterRunResult {
  const rows = parse(readFileSync(csvPath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
  }) as AsheSampleRow[];
  const points: BenchmarkPoint[] = [];
  let rowsSkipped = 0;
  const skipReasons: Record<string, number> = {};

  for (const row of rows) {
    const match = normalizer.normalize(row.title);
    if (!match) {
      rowsSkipped++;
      skipReasons["no-cross-taxonomy-match"] =
        (skipReasons["no-cross-taxonomy-match"] ?? 0) + 1;
      continue;
    }
    const sampleSize = Math.round(Number(row.sample_size_thousands) * 1000);
    const confidence =
      sampleSize >= 200_000 ? "high" : sampleSize >= 50_000 ? "medium" : "low";
    for (const pct of PERCENTILES) {
      points.push({
        occupationSocCode: match.socCode,
        occupationTitleRaw: row.title,
        employerName: null,
        country: "GB",
        region: null,
        city: null,
        percentile: pct,
        payAmount: Number(row[pct]),
        payCurrency: "GBP",
        sampleSize,
        confidence,
      });
    }
  }

  return {
    sourceKey: "ons-ashe",
    sourceUrl:
      "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/occupation4digitsoc2010ashetable14 (sample — see docs/data-sources.md)",
    points,
    rowsParsed: rows.length,
    rowsSkipped,
    skipReasons,
  };
}

interface DolLcaSampleRow {
  CASE_NUMBER: string;
  CASE_STATUS: string;
  SOC_CODE: string;
  SOC_TITLE: string;
  JOB_TITLE: string;
  EMPLOYER_NAME: string;
  WORKSITE_CITY: string;
  WORKSITE_STATE: string;
  FULL_TIME_POSITION: string;
  WAGE_RATE_OF_PAY_FROM: string;
  WAGE_RATE_OF_PAY_TO: string;
  WAGE_UNIT_OF_PAY: string;
}

const ANNUALIZATION_HOURS_PER_YEAR = 2080;
function annualize(amount: number, unit: string): number | null {
  switch (unit) {
    case "Year":
      return amount;
    case "Month":
      return amount * 12;
    case "Bi-Weekly":
      return amount * 26;
    case "Week":
      return amount * 52;
    case "Hour":
      return amount * ANNUALIZATION_HOURS_PER_YEAR;
    default:
      return null;
  }
}

/** Returns raw observations, not BenchmarkPoints — DOL sample rows still need aggregate.ts. */
export function loadDolLcaSampleObservations(csvPath: string): {
  observations: RawObservation[];
  rowsParsed: number;
  rowsSkipped: number;
  skipReasons: Record<string, number>;
} {
  const rows = parse(readFileSync(csvPath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
  }) as DolLcaSampleRow[];
  const observations: RawObservation[] = [];
  let rowsSkipped = 0;
  const skipReasons: Record<string, number> = {};
  const skip = (reason: string) => {
    rowsSkipped++;
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
  };

  for (const row of rows) {
    const wageFrom = Number(row.WAGE_RATE_OF_PAY_FROM);
    const wageTo = row.WAGE_RATE_OF_PAY_TO
      ? Number(row.WAGE_RATE_OF_PAY_TO)
      : null;
    if (!Number.isFinite(wageFrom) || wageFrom <= 0) {
      skip("missing-wage");
      continue;
    }
    const rawAmount =
      wageTo && wageTo > wageFrom ? (wageFrom + wageTo) / 2 : wageFrom;
    const annual = annualize(rawAmount, row.WAGE_UNIT_OF_PAY);
    if (annual == null) {
      skip(`unrecognized-wage-unit:${row.WAGE_UNIT_OF_PAY}`);
      continue;
    }
    const jobTitle = (row.JOB_TITLE || row.SOC_TITLE || "").trim();
    if (!jobTitle) {
      skip("missing-job-title");
      continue;
    }
    observations.push({
      occupationTitleRaw: jobTitle,
      occupationSocCodeHint: row.SOC_CODE?.trim() || null,
      employerName: row.EMPLOYER_NAME?.trim() || null,
      country: "US",
      region: row.WORKSITE_STATE?.trim() || null,
      city: row.WORKSITE_CITY?.trim() || null,
      payAnnual: Math.round(annual * 100) / 100,
      payCurrency: "USD",
    });
  }

  return { observations, rowsParsed: rows.length, rowsSkipped, skipReasons };
}
