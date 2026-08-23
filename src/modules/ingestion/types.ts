export type Confidence = "high" | "medium" | "low";
export type Percentile = "p10" | "p25" | "p50" | "p75" | "p90";
export const PERCENTILES: readonly Percentile[] = [
  "p10",
  "p25",
  "p50",
  "p75",
  "p90",
];

/**
 * A single raw pay observation extracted from a source, before aggregation.
 * Used for sources that publish individual-level records (DOL LCA) rather
 * than a pre-computed distribution.
 */
export interface RawObservation {
  occupationTitleRaw: string;
  occupationSocCodeHint: string | null; // set when the source already tags a SOC code
  employerName: string | null;
  country: string;
  region: string | null;
  city: string | null;
  payAnnual: number;
  payCurrency: string;
}

/**
 * One percentile point of a distribution, shaped exactly like a
 * salary_benchmarks row minus the DB-generated/provenance fields the
 * ingestion orchestrator fills in (sourceId, sourceUrl, ingestedAt,
 * dedupeKey, employerId).
 */
export interface BenchmarkPoint {
  occupationSocCode: string;
  occupationTitleRaw: string;
  employerName: string | null;
  country: string;
  region: string | null;
  city: string | null;
  percentile: Percentile;
  payAmount: number;
  payCurrency: string;
  sampleSize: number | null;
  confidence: Confidence;
}

export interface AdapterRunResult {
  sourceKey: string;
  sourceUrl: string;
  points: BenchmarkPoint[];
  rowsParsed: number;
  rowsSkipped: number;
  skipReasons: Record<string, number>;
}

export interface OccupationRecord {
  socCode: string;
  title: string;
  description: string | null;
  aliases: string[];
}
