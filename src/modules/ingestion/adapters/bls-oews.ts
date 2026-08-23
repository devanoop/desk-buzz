import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import type { AdapterRunResult, BenchmarkPoint, Percentile } from "../types";
import type { OccupationNormalizer } from "../occupation-normalizer";

export const SOURCE_KEY = "bls-oews";

/**
 * Bulk-file column layout per BLS's long-published OEWS technical
 * documentation (stable across releases for years). NOT independently
 * re-fetched this session — bls.gov's bulk-file host returns 403 to this
 * environment (see docs/data-sources.md §1). The parser validates every
 * required column is present before doing anything else, and throws
 * (rather than silently proceeding) if BLS has renamed or dropped one —
 * "fail loudly on a reshaped source" per the brief.
 */
const REQUIRED_COLUMNS = [
  "AREA_TITLE",
  "AREA_TYPE",
  "OCC_CODE",
  "OCC_TITLE",
  "TOT_EMP",
  "A_PCT10",
  "A_PCT25",
  "A_MEDIAN",
  "A_PCT75",
  "A_PCT90",
] as const;

const PERCENTILE_COLUMNS: Record<Percentile, string> = {
  p10: "A_PCT10",
  p25: "A_PCT25",
  p50: "A_MEDIAN",
  p75: "A_PCT75",
  p90: "A_PCT90",
};

export function currentBulkFileUrl(
  mayYear = new Date().getFullYear() - 1,
): string {
  const yy = String(mayYear).slice(-2);
  return `https://www.bls.gov/oes/special-requests/oesm${yy}all.zip`;
}

export async function fetchBlsOewsZip(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `BLS OEWS fetch failed: ${res.status} ${res.statusText} (${url})`,
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("zip") && !contentType.includes("octet-stream")) {
    throw new Error(
      `BLS OEWS fetch returned unexpected content-type "${contentType}" — source may have changed shape.`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Numbers BLS suppresses for disclosure/reliability reasons are printed as literal "*" or "**". */
function parseBlsNumber(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    if (
      cleaned === "" ||
      cleaned === "*" ||
      cleaned === "**" ||
      cleaned === "#"
    )
      return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parses one worksheet of the OEWS "all data" workbook (the zip contains a
 * single national+state+MSA sheet in recent vintages). Only NATIONAL rows
 * (AREA_TYPE === "1") are kept for salary_benchmarks at this phase — state
 * and MSA rows use the same column shape and can be enabled later without
 * a schema change.
 */
export function parseOewsWorksheet(
  worksheet: ExcelJS.Worksheet,
  normalizer: OccupationNormalizer,
): {
  points: BenchmarkPoint[];
  rowsParsed: number;
  rowsSkipped: number;
  skipReasons: Record<string, number>;
} {
  const headerRow = worksheet.getRow(1).values as ExcelJS.CellValue[];
  const colIndex = new Map<string, number>();
  headerRow.forEach((v, i) => {
    if (typeof v === "string") colIndex.set(v.trim(), i);
  });

  for (const col of REQUIRED_COLUMNS) {
    if (!colIndex.has(col)) {
      throw new Error(
        `BLS OEWS parser: expected column "${col}" not found — source has likely changed shape.`,
      );
    }
  }

  const points: BenchmarkPoint[] = [];
  let rowsParsed = 0;
  let rowsSkipped = 0;
  const skipReasons: Record<string, number> = {};
  const skip = (reason: string) => {
    rowsSkipped++;
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
  };

  const col = (row: ExcelJS.CellValue[], name: string) =>
    row[colIndex.get(name)!];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rowsParsed++;
    const values = row.values as ExcelJS.CellValue[];

    const areaType = String(col(values, "AREA_TYPE") ?? "");
    if (areaType !== "1") return skip("not-national-row"); // state/MSA rows, out of scope this phase

    const occCode = String(col(values, "OCC_CODE") ?? "").trim();
    const occTitle = String(col(values, "OCC_TITLE") ?? "").trim();
    if (!occCode || !occTitle) return skip("missing-occupation");

    // BLS OEWS publishes at the 6-digit base-SOC level ("15-1252"); O*NET's
    // taxonomy adds a ".00"/".01"/... detail suffix. BLS's own base code
    // always corresponds to the O*NET ".00" entry for that SOC — appending
    // it is the standard mapping, not a guess. Falls back to a fuzzy title
    // match if that exact code isn't in the taxonomy (e.g. a retired code).
    const match =
      normalizer.bySocCode(`${occCode}.00`) ?? normalizer.normalize(occTitle);
    if (!match) return skip("occupation-not-in-taxonomy");

    const sampleSize = parseBlsNumber(col(values, "TOT_EMP"));

    const percentileValues: Partial<Record<Percentile, number>> = {};
    let anyMissing = false;
    for (const [pct, colName] of Object.entries(PERCENTILE_COLUMNS) as [
      Percentile,
      string,
    ][]) {
      const n = parseBlsNumber(col(values, colName));
      if (n == null) {
        anyMissing = true;
        break;
      }
      percentileValues[pct] = n;
    }
    if (anyMissing) return skip("suppressed-or-missing-wage");

    for (const pct of Object.keys(PERCENTILE_COLUMNS) as Percentile[]) {
      points.push({
        occupationSocCode: match.socCode,
        occupationTitleRaw: occTitle,
        employerName: null,
        country: "US",
        region: null,
        city: null,
        percentile: pct,
        payAmount: percentileValues[pct]!,
        payCurrency: "USD",
        sampleSize,
        confidence:
          sampleSize != null && sampleSize >= 1000
            ? "high"
            : sampleSize != null && sampleSize >= 100
              ? "medium"
              : "low",
      });
    }
  });

  return { points, rowsParsed, rowsSkipped, skipReasons };
}

export async function parseBlsOewsZip(
  zipBuffer: Buffer,
  normalizer: OccupationNormalizer,
): Promise<ReturnType<typeof parseOewsWorksheet>> {
  // adm-zip's bundled types predate @types/node's generic Buffer<ArrayBufferLike>
  // change; the value is a real Buffer at runtime, this is a type-only mismatch.
  const zip = new AdmZip(zipBuffer as unknown as Buffer);
  const entry = zip
    .getEntries()
    .find((e) => /\.xlsx?$/i.test(e.entryName) && /all/i.test(e.entryName));
  if (!entry) {
    throw new Error(
      "BLS OEWS zip did not contain an expected 'all data' workbook — source may have changed shape.",
    );
  }
  const workbook = new ExcelJS.Workbook();
  // exceljs transitively bundles fast-csv, which pulls in @types/node@14
  // (pre-generic Buffer) alongside this project's @types/node@22, so TS
  // sees two structurally different "Buffer" types here. Real value is a
  // plain Buffer at runtime either way.
  // @ts-expect-error — transitive @types/node version skew, see comment above
  await workbook.xlsx.load(entry.getData());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("BLS OEWS workbook has no worksheets.");
  return parseOewsWorksheet(worksheet, normalizer);
}

export async function runBlsOewsAdapter(
  normalizer: OccupationNormalizer,
  options: { url?: string } = {},
): Promise<AdapterRunResult> {
  const url = options.url ?? currentBulkFileUrl();
  const zipBuffer = await fetchBlsOewsZip(url);
  const { points, rowsParsed, rowsSkipped, skipReasons } =
    await parseBlsOewsZip(zipBuffer, normalizer);
  return {
    sourceKey: SOURCE_KEY,
    sourceUrl: url,
    points,
    rowsParsed,
    rowsSkipped,
    skipReasons,
  };
}
