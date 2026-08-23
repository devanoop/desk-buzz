import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import ExcelJS from "exceljs";
import type { RawObservation } from "../types";

export const SOURCE_KEY = "dol-lca";

const KEEP_STATUSES = new Set(["Certified", "Certified - Withdrawn"]);

// Standard full-time annualization convention (40hr/week x 52wk). LCA doesn't
// reliably report actual hours/week, so hourly-rate rows are annualized
// under this assumption regardless of FULL_TIME_POSITION — a documented
// simplification, not a silent one. Non-hourly pay units convert exactly.
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
      return null; // unrecognized unit — skip rather than guess
  }
}

export function currentDisclosureFileUrl(
  fiscalYear: number,
  quarter: 1 | 2 | 3 | 4,
): string {
  return `https://www.dol.gov/media/LCA_Disclosure_Data_FY${fiscalYear}_Q${quarter}.xlsx`;
}

/** Streams the file to disk rather than buffering ~240MB in memory. */
export async function fetchDolLcaFile(
  url: string,
  destPath: string,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `DOL LCA fetch failed: ${res.status} ${res.statusText} (${url})`,
    );
  }
  if (!res.body) throw new Error("DOL LCA fetch returned no body");
  const out = createWriteStream(destPath);
  await finished(Readable.fromWeb(res.body as never).pipe(out));
}

const REQUIRED_COLUMNS = [
  "CASE_STATUS",
  "SOC_CODE",
  "SOC_TITLE",
  "JOB_TITLE",
  "EMPLOYER_NAME",
  "WORKSITE_CITY",
  "WORKSITE_STATE",
  "WAGE_RATE_OF_PAY_FROM",
  "WAGE_RATE_OF_PAY_TO",
  "WAGE_UNIT_OF_PAY",
] as const;

export interface DolLcaParseResult {
  observations: RawObservation[];
  rowsParsed: number;
  rowsSkipped: number;
  skipReasons: Record<string, number>;
}

export function resolveLcaColumnIndex(
  headerValues: ExcelJS.CellValue[],
): Record<string, number> {
  const colIndex: Record<string, number> = {};
  for (const name of REQUIRED_COLUMNS) {
    const idx = headerValues.findIndex((h) => h === name);
    if (idx === -1) {
      throw new Error(
        `DOL LCA parser: expected column "${name}" not found — source has likely changed shape.`,
      );
    }
    colIndex[name] = idx;
  }
  return colIndex;
}

export type LcaRowResult =
  | { observation: RawObservation }
  | { skipReason: string };

/**
 * Pure per-row processor — factored out from the streaming file loop so it
 * can be unit-tested directly with plain values arrays, independent of
 * ExcelJS's streaming reader (which has a known flaky failure mode when
 * reading a workbook immediately after it's written in the same process,
 * as happens in tests; not a concern for the real pipeline, which always
 * reads a file fetched over HTTP in a separate run).
 */
export function processLcaRow(
  colIndex: Record<string, number>,
  values: ExcelJS.CellValue[],
): LcaRowResult {
  const get = (name: (typeof REQUIRED_COLUMNS)[number]) =>
    values[colIndex[name]];

  const status = String(get("CASE_STATUS") ?? "");
  if (!KEEP_STATUSES.has(status)) return { skipReason: "not-certified" };

  const wageFrom = get("WAGE_RATE_OF_PAY_FROM");
  const wageTo = get("WAGE_RATE_OF_PAY_TO");
  const unit = String(get("WAGE_UNIT_OF_PAY") ?? "");
  if (typeof wageFrom !== "number" || wageFrom <= 0)
    return { skipReason: "missing-wage" };

  // Midpoint of the posted range when a "to" is given, else the single rate.
  const rawAmount =
    typeof wageTo === "number" && wageTo > wageFrom
      ? (wageFrom + wageTo) / 2
      : wageFrom;
  const annual = annualize(rawAmount, unit);
  if (annual == null) return { skipReason: `unrecognized-wage-unit:${unit}` };

  const employerName = String(get("EMPLOYER_NAME") ?? "").trim() || null;
  const city = String(get("WORKSITE_CITY") ?? "").trim() || null;
  const region = String(get("WORKSITE_STATE") ?? "").trim() || null;
  const socCode = String(get("SOC_CODE") ?? "").trim() || null;
  // "??" only falls through on null/undefined, not "" — JOB_TITLE is
  // occasionally present-but-blank in real data, so blank must be checked
  // explicitly to actually fall back to SOC_TITLE.
  const jobTitleRaw = String(get("JOB_TITLE") ?? "").trim();
  const jobTitle = jobTitleRaw || String(get("SOC_TITLE") ?? "").trim();
  if (!jobTitle) return { skipReason: "missing-job-title" };

  return {
    observation: {
      occupationTitleRaw: jobTitle,
      occupationSocCodeHint: socCode,
      employerName,
      country: "US",
      region,
      city,
      payAnnual: Math.round(annual * 100) / 100,
      payCurrency: "USD",
    },
  };
}

/**
 * Streams and parses the real LCA disclosure workbook. Column positions are
 * resolved by name from the header row (not hardcoded indices) — DOL has
 * reordered columns across fiscal years before, and the real header was
 * independently confirmed this session (docs/data-sources.md §2).
 */
export async function parseDolLcaFile(
  filePath: string,
): Promise<DolLcaParseResult> {
  const observations: RawObservation[] = [];
  let rowsParsed = 0;
  let rowsSkipped = 0;
  const skipReasons: Record<string, number> = {};

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {});
  let colIndex: Record<string, number> | null = null;

  for await (const worksheet of reader) {
    for await (const row of worksheet) {
      const values = row.values as ExcelJS.CellValue[];

      if (row.number === 1) {
        colIndex = resolveLcaColumnIndex(values);
        continue;
      }
      if (!colIndex) break;
      rowsParsed++;

      const result = processLcaRow(colIndex, values);
      if ("skipReason" in result) {
        rowsSkipped++;
        skipReasons[result.skipReason] =
          (skipReasons[result.skipReason] ?? 0) + 1;
      } else {
        observations.push(result.observation);
      }
    }
    break; // single-sheet file
  }

  return { observations, rowsParsed, rowsSkipped, skipReasons };
}

export async function runDolLcaAdapter(options: {
  fiscalYear?: number;
  quarter?: 1 | 2 | 3 | 4;
  localFilePath?: string;
  tmpDownloadPath?: string;
}): Promise<{ sourceKey: string; sourceUrl: string } & DolLcaParseResult> {
  const url =
    options.localFilePath ??
    currentDisclosureFileUrl(
      options.fiscalYear ?? new Date().getFullYear(),
      options.quarter ?? 4,
    );

  let filePath = options.localFilePath;
  if (!filePath) {
    filePath = options.tmpDownloadPath ?? `/tmp/dol-lca-${Date.now()}.xlsx`;
    await fetchDolLcaFile(url, filePath);
  }

  const result = await parseDolLcaFile(filePath);
  return { sourceKey: SOURCE_KEY, sourceUrl: url, ...result };
}
