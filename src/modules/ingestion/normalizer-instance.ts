import {
  loadOnetOccupations,
  OccupationNormalizer,
} from "./occupation-normalizer";

// Lazy singleton — the O*NET taxonomy (~1,300 rows across two CSVs) doesn't
// change at runtime, so it's loaded once per process and reused by both the
// ingestion CLI and the application's salary-report submission path (which
// normalizes free-text job titles the same way ingestion adapters do).
let instance: OccupationNormalizer | undefined;

export function getSharedOccupationNormalizer(): OccupationNormalizer {
  if (!instance) {
    const records = loadOnetOccupations(
      "data/onet/occupation_data.csv",
      "data/onet/sample_of_reported_titles.csv",
    );
    instance = new OccupationNormalizer(records);
  }
  return instance;
}
