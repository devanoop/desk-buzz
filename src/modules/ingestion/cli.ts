#!/usr/bin/env node
// Ingestion CLI. Usage:
//   npm run ingest -- --source=all --mode=seed     (default — loads the committed samples, fast, no network)
//   npm run ingest -- --source=bls-oews --mode=full  (re-downloads and parses the real live source)
//   npm run ingest -- --source=dol-lca --mode=full --fiscal-year=2026 --quarter=3
//
// Each source is independently runnable (per the brief) — --source selects
// exactly one adapter, or "all" to run every source in sequence.

import {
  loadOnetOccupations,
  OccupationNormalizer,
} from "./occupation-normalizer";
import {
  loadBlsSample,
  loadAsheSample,
  loadDolLcaSampleObservations,
} from "./load-samples";
import { runBlsOewsAdapter } from "./adapters/bls-oews";
import { runOnsAsheAdapter } from "./adapters/ons-ashe";
import { runDolLcaAdapter } from "./adapters/dol-lca";
import { aggregateObservations } from "./aggregate";
import { runAndIngest } from "./ingest";
import { closeDb } from "../db/client";
import type { AdapterRunResult, OccupationRecord } from "./types";

const ONET_OCCUPATION_DATA = "data/onet/occupation_data.csv";
const ONET_REPORTED_TITLES = "data/onet/sample_of_reported_titles.csv";

const SOURCES = {
  "bls-oews": {
    name: "US BLS Occupational Employment and Wage Statistics",
    licence: "Public domain (US federal government work)",
    landingUrl: "https://www.bls.gov/oes/",
  },
  "dol-lca": {
    name: "US DOL OFLC LCA Disclosure Data",
    licence: "Public domain (US federal government work)",
    landingUrl: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  },
  "ons-ashe": {
    name: "UK ONS Annual Survey of Hours and Earnings (Table 14)",
    licence: "Open Government Licence v3.0",
    landingUrl:
      "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/occupation4digitsoc2010ashetable14",
  },
} as const;
type SourceKey = keyof typeof SOURCES;

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) args[m[1]] = m[2];
  }
  return {
    source: (args.source ?? "all") as SourceKey | "all",
    mode: (args.mode ?? "seed") as "seed" | "full",
    fiscalYear: args["fiscal-year"]
      ? Number(args["fiscal-year"])
      : new Date().getFullYear(),
    quarter: (args.quarter ? Number(args.quarter) : 4) as 1 | 2 | 3 | 4,
  };
}

async function runOne(
  key: SourceKey,
  mode: "seed" | "full",
  normalizer: OccupationNormalizer,
  occupationRecords: OccupationRecord[],
  fiscalYear: number,
  quarter: 1 | 2 | 3 | 4,
) {
  const meta = SOURCES[key];
  console.log(`\n=== ${key} (${mode}) ===`);

  let adapterResult: AdapterRunResult;

  if (key === "bls-oews") {
    adapterResult =
      mode === "seed"
        ? loadBlsSample("data/samples/bls-oews-sample.csv", normalizer)
        : await runBlsOewsAdapter(normalizer);
  } else if (key === "ons-ashe") {
    adapterResult =
      mode === "seed"
        ? loadAsheSample("data/samples/ons-ashe-sample.csv", normalizer)
        : await runOnsAsheAdapter(normalizer);
  } else {
    // dol-lca: individual-level records, always goes through the aggregation layer.
    const { observations, rowsParsed, rowsSkipped, skipReasons } =
      mode === "seed"
        ? loadDolLcaSampleObservations("data/samples/dol-lca-sample.csv")
        : await runDolLcaAdapter({ fiscalYear, quarter });
    const { points, stats } = aggregateObservations(observations, normalizer);
    adapterResult = {
      sourceKey: "dol-lca",
      sourceUrl:
        mode === "seed"
          ? "sample — see docs/data-sources.md"
          : `https://www.dol.gov/media/LCA_Disclosure_Data_FY${fiscalYear}_Q${quarter}.xlsx`,
      points,
      rowsParsed,
      rowsSkipped: rowsSkipped + stats.observationsSkippedNoOccupation,
      skipReasons: {
        ...skipReasons,
        "no-occupation-match": stats.observationsSkippedNoOccupation,
        "group-below-min-sample-size": stats.groupsSuppressed,
      },
    };
  }

  console.log(
    `Parsed ${adapterResult.rowsParsed} rows, skipped ${adapterResult.rowsSkipped}, produced ${adapterResult.points.length} benchmark points.`,
  );
  if (Object.keys(adapterResult.skipReasons).length > 0) {
    console.log("Skip reasons:", adapterResult.skipReasons);
  }

  const summary = await runAndIngest(adapterResult, {
    sourceKey: key,
    sourceName: meta.name,
    sourceLicence: meta.licence,
    sourceLandingUrl: meta.landingUrl,
    occupationRecords,
    triggeredBy: "manual",
  });
  console.log(
    `Ingested ${summary.processed} rows (${summary.occupationsSkipped} skipped for unmatched occupation).`,
  );
}

async function main() {
  const { source, mode, fiscalYear, quarter } = parseArgs(
    process.argv.slice(2),
  );

  console.log("Loading O*NET occupation taxonomy...");
  const occupationRecords = loadOnetOccupations(
    ONET_OCCUPATION_DATA,
    ONET_REPORTED_TITLES,
  );
  const normalizer = new OccupationNormalizer(occupationRecords);
  console.log(`Loaded ${occupationRecords.length} occupations.`);

  const keys: SourceKey[] =
    source === "all" ? (Object.keys(SOURCES) as SourceKey[]) : [source];

  try {
    for (const key of keys) {
      await runOne(
        key,
        mode,
        normalizer,
        occupationRecords,
        fiscalYear,
        quarter,
      );
    }
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exitCode = 1;
});
