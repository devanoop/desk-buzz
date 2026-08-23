import AdmZip from "adm-zip";
import ExcelJS from "exceljs";
import type { AdapterRunResult, BenchmarkPoint, Percentile } from "../types";
import type { OccupationNormalizer } from "../occupation-normalizer";

export const SOURCE_KEY = "ons-ashe";

const ANNUAL_PAY_ENTRY_PATTERN = /Table 14\.7a\s+Annual pay - Gross/i;

export function currentAsheTable14Url(year = "2025provisional"): string {
  return `https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/occupation4digitsoc2010ashetable14/${year}/ashetable14${year}.zip`;
}

export async function fetchAsheZip(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `ONS ASHE fetch failed: ${res.status} ${res.statusText} (${url})`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

// Column positions in the "All" sheet, confirmed against the real 2025
// provisional Table 14.7a file this session (see docs/data-sources.md §3):
// col 1 = Description, col 2 = Code, col 3 = jobs (thousands), col 4 =
// Median, cols 8/10/15/17 = percentiles 10/25/75/90.
const COL = {
  description: 1,
  code: 2,
  jobsThousands: 3,
  median: 4,
  p10: 8,
  p25: 10,
  p75: 15,
  p90: 17,
} as const;

function asNumber(v: ExcelJS.CellValue): number | null {
  return typeof v === "number" ? v : null;
}

export function parseAsheWorksheet(
  worksheet: ExcelJS.Worksheet,
  normalizer: OccupationNormalizer,
): {
  points: BenchmarkPoint[];
  rowsParsed: number;
  rowsSkipped: number;
  skipReasons: Record<string, number>;
} {
  const points: BenchmarkPoint[] = [];
  let rowsParsed = 0;
  let rowsSkipped = 0;
  const skipReasons: Record<string, number> = {};
  const skip = (reason: string) => {
    rowsSkipped++;
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
  };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 6) return; // title/header rows
    const v = row.values as ExcelJS.CellValue[];
    const code = v[COL.code];
    if (typeof code !== "string" || !/^\d{4}$/.test(code.trim())) return; // 4-digit SOC only, skip 1/2/3-digit rollups silently (not an error, just a different granularity)

    rowsParsed++;
    const title = String(v[COL.description] ?? "").trim();
    const jobsThousands = asNumber(v[COL.jobsThousands]);
    const percentileValues: Partial<Record<Percentile, number>> = {
      p10: asNumber(v[COL.p10]) ?? undefined,
      p25: asNumber(v[COL.p25]) ?? undefined,
      p50: asNumber(v[COL.median]) ?? undefined,
      p75: asNumber(v[COL.p75]) ?? undefined,
      p90: asNumber(v[COL.p90]) ?? undefined,
    };

    if (
      !title ||
      jobsThousands == null ||
      Object.values(percentileValues).some((n) => n == null)
    ) {
      skip("suppressed-or-missing-value"); // ONS's own "x" (CV > 20%) or disclosure suppression
      return;
    }

    // UK SOC 2020 (ONS's own classification) has no code-level mapping to
    // the US-built O*NET taxonomy this pipeline standardizes on — the two
    // are maintained independently by different national statistical
    // agencies. Cross-taxonomy title matching is the only honest option;
    // rows below the normalizer's fuzzy threshold are skipped rather than
    // force-mapped to a plausible-looking but unverified O*NET code.
    const match = normalizer.normalize(title);
    if (!match) {
      skip("no-cross-taxonomy-match");
      return;
    }

    const sampleSize = Math.round(jobsThousands * 1000);
    const confidence =
      sampleSize >= 200_000 ? "high" : sampleSize >= 50_000 ? "medium" : "low";

    for (const [pct, amount] of Object.entries(percentileValues) as [
      Percentile,
      number,
    ][]) {
      points.push({
        occupationSocCode: match.socCode,
        occupationTitleRaw: title,
        employerName: null,
        country: "GB",
        region: null,
        city: null,
        percentile: pct,
        payAmount: amount,
        payCurrency: "GBP",
        sampleSize,
        confidence,
      });
    }
  });

  return { points, rowsParsed, rowsSkipped, skipReasons };
}

export async function parseAsheZip(
  zipBuffer: Buffer,
  normalizer: OccupationNormalizer,
): Promise<ReturnType<typeof parseAsheWorksheet>> {
  // adm-zip's bundled types predate @types/node's generic Buffer<ArrayBufferLike>
  // change; the value is a real Buffer at runtime, this is a type-only mismatch.
  const zip = new AdmZip(zipBuffer as unknown as Buffer);
  const entry = zip
    .getEntries()
    .find((e) => ANNUAL_PAY_ENTRY_PATTERN.test(e.entryName));
  if (!entry) {
    throw new Error(
      "ONS ASHE zip did not contain the expected 'Table 14.7a Annual pay - Gross' workbook.",
    );
  }
  const workbook = new ExcelJS.Workbook();
  // exceljs transitively bundles fast-csv, which pulls in @types/node@14
  // (pre-generic Buffer) alongside this project's @types/node@22, so TS
  // sees two structurally different "Buffer" types here. Real value is a
  // plain Buffer at runtime either way.
  // @ts-expect-error — transitive @types/node version skew, see comment above
  await workbook.xlsx.load(entry.getData());
  const worksheet = workbook.getWorksheet("All");
  if (!worksheet) throw new Error('ONS ASHE workbook has no "All" worksheet.');
  return parseAsheWorksheet(worksheet, normalizer);
}

export async function runOnsAsheAdapter(
  normalizer: OccupationNormalizer,
  options: { url?: string } = {},
): Promise<AdapterRunResult> {
  const url = options.url ?? currentAsheTable14Url();
  const zipBuffer = await fetchAsheZip(url);
  const { points, rowsParsed, rowsSkipped, skipReasons } = await parseAsheZip(
    zipBuffer,
    normalizer,
  );
  return {
    sourceKey: SOURCE_KEY,
    sourceUrl: url,
    points,
    rowsParsed,
    rowsSkipped,
    skipReasons,
  };
}
