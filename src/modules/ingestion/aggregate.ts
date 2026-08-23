import type { BenchmarkPoint, Confidence, RawObservation } from "./types";
import { PERCENTILES } from "./types";
import type { OccupationNormalizer } from "./occupation-normalizer";

/**
 * Below this many observations in a group, the aggregation layer suppresses
 * the group entirely rather than publishing a percentile spread computed
 * from too few points to mean anything — per the brief's explicit
 * "minimum sample-size threshold below which figures are suppressed rather
 * than shown" requirement. 3 is the floor at which p10/p90 stop being the
 * same one or two data points wearing different labels.
 */
export const MIN_SAMPLE_SIZE = 3;

const HIGH_CONFIDENCE_MIN = 30;
const MEDIUM_CONFIDENCE_MIN = 10;

export function deriveConfidence(sampleSize: number): Confidence {
  if (sampleSize >= HIGH_CONFIDENCE_MIN) return "high";
  if (sampleSize >= MEDIUM_CONFIDENCE_MIN) return "medium";
  return "low";
}

/** Linear-interpolation percentile (the common "inclusive"/R-7 method). */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0)
    throw new Error("percentile() called on an empty array");
  if (sortedValues.length === 1) return sortedValues[0];
  const rank = p * (sortedValues.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const weight = rank - lowerIndex;
  return (
    sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight
  );
}

const PERCENTILE_FRACTIONS: Record<(typeof PERCENTILES)[number], number> = {
  p10: 0.1,
  p25: 0.25,
  p50: 0.5,
  p75: 0.75,
  p90: 0.9,
};

interface GroupKey {
  occupationSocCode: string;
  occupationTitle: string;
  employerName: string | null;
  country: string;
  region: string | null;
  city: string | null;
  payCurrency: string;
}

const groupKeyString = (k: GroupKey) =>
  [
    k.occupationSocCode,
    k.employerName ?? "",
    k.country,
    k.region ?? "",
    k.city ?? "",
    k.payCurrency,
  ].join("");

export interface AggregationStats {
  groupsConsidered: number;
  groupsSuppressed: number;
  observationsSkippedNoOccupation: number;
}

/**
 * Groups raw per-record observations by (occupation, employer, geography,
 * currency) and computes a p10/p25/p50/p75/p90 distribution per group.
 * Never blends currencies or countries into one figure, and never emits a
 * group below MIN_SAMPLE_SIZE.
 */
export function aggregateObservations(
  observations: RawObservation[],
  normalizer: OccupationNormalizer,
  stats: AggregationStats = {
    groupsConsidered: 0,
    groupsSuppressed: 0,
    observationsSkippedNoOccupation: 0,
  },
): { points: BenchmarkPoint[]; stats: AggregationStats } {
  const groups = new Map<string, { key: GroupKey; values: number[] }>();

  for (const obs of observations) {
    const match = obs.occupationSocCodeHint
      ? (normalizer.bySocCode(obs.occupationSocCodeHint) ??
        normalizer.normalize(obs.occupationTitleRaw))
      : normalizer.normalize(obs.occupationTitleRaw);

    if (!match) {
      stats.observationsSkippedNoOccupation++;
      continue;
    }

    const key: GroupKey = {
      occupationSocCode: match.socCode,
      occupationTitle: match.title,
      employerName: obs.employerName,
      country: obs.country,
      region: obs.region,
      city: obs.city,
      payCurrency: obs.payCurrency,
    };
    const keyStr = groupKeyString(key);
    if (!groups.has(keyStr)) groups.set(keyStr, { key, values: [] });
    groups.get(keyStr)!.values.push(obs.payAnnual);
  }

  const points: BenchmarkPoint[] = [];
  for (const { key, values } of groups.values()) {
    stats.groupsConsidered++;
    if (values.length < MIN_SAMPLE_SIZE) {
      stats.groupsSuppressed++;
      continue;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const confidence = deriveConfidence(sorted.length);
    for (const p of PERCENTILES) {
      points.push({
        occupationSocCode: key.occupationSocCode,
        occupationTitleRaw: key.occupationTitle,
        employerName: key.employerName,
        country: key.country,
        region: key.region,
        city: key.city,
        percentile: p,
        payAmount:
          Math.round(percentile(sorted, PERCENTILE_FRACTIONS[p]) * 100) / 100,
        payCurrency: key.payCurrency,
        sampleSize: sorted.length,
        confidence,
      });
    }
  }

  return { points, stats };
}
