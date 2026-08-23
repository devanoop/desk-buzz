import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import { parseAsheWorksheet } from "../../adapters/ons-ashe";
import {
  loadOnetOccupations,
  OccupationNormalizer,
} from "../../occupation-normalizer";

// Mirrors the real ASHE Table 14.7a "All" sheet shape confirmed this session:
// 5 header/title rows, then data rows with Description(col1), Code(col2),
// jobs-thousands(col3), Median(col4), ..., p10(col8), p25(col10), p75(col15), p90(col17).
function buildAsheWorksheet(
  rows: Array<(string | number)[]>,
): ExcelJS.Worksheet {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("All");
  for (let i = 0; i < 5; i++) ws.addRow([]); // rows 1-5 are title/header noise, real parser starts at row 6
  for (const row of rows) ws.addRow(row);
  return ws;
}

// Builds a full 17-column row matching the real column indices (1-indexed
// against COL in the adapter): 1=desc, 2=code, 3=jobs(k), 4=median, 8=p10,
// 10=p25, 15=p75, 17=p90. Unused positions are blank.
function asheRow(
  desc: string,
  code: string,
  jobsK: number,
  median: number,
  p10: number,
  p25: number,
  p75: number,
  p90: number,
) {
  const row = new Array(18).fill("");
  row[1] = desc;
  row[2] = code;
  row[3] = jobsK;
  row[4] = median;
  row[8] = p10;
  row[10] = p25;
  row[15] = p75;
  row[17] = p90;
  return row.slice(1); // ExcelJS addRow is 0-indexed array -> column 1; drop the placeholder 0 slot
}

describe("parseAsheWorksheet", () => {
  let normalizer: OccupationNormalizer;

  beforeAll(() => {
    const records = loadOnetOccupations(
      "data/onet/occupation_data.csv",
      "data/onet/sample_of_reported_titles.csv",
    );
    normalizer = new OccupationNormalizer(records);
  });

  it("parses a real-shaped 4-digit SOC row into 5 GBP percentile points", () => {
    const ws = buildAsheWorksheet([
      asheRow(
        "Programmers and software development professionals",
        "2134",
        360,
        55587,
        30752,
        41141,
        75077,
        101172,
      ),
    ]);
    const { points, rowsParsed, rowsSkipped } = parseAsheWorksheet(
      ws,
      normalizer,
    );
    expect(rowsParsed).toBe(1);
    expect(rowsSkipped).toBe(0);
    expect(points).toHaveLength(5);
    expect(
      points.every((p) => p.country === "GB" && p.payCurrency === "GBP"),
    ).toBe(true);
    // Cross-taxonomy fuzzy match should land on the real O*NET software developer code.
    expect(points[0].occupationSocCode).toBe("15-1252.00");
    const median = points.find((p) => p.percentile === "p50")!;
    expect(median.payAmount).toBe(55587);
    expect(median.sampleSize).toBe(360_000);
  });

  it("skips non-4-digit rollup rows (1/2/3-digit SOC hierarchy) without treating it as an error", () => {
    const ws = buildAsheWorksheet([
      asheRow(
        "Managers, directors and senior officials",
        "1",
        2863,
        51733,
        22303,
        30583,
        81426,
        126756,
      ),
    ]);
    const { points, rowsParsed } = parseAsheWorksheet(ws, normalizer);
    expect(points).toHaveLength(0);
    expect(rowsParsed).toBe(0); // 1-digit rows aren't counted as parsed at all, matching the real extraction script's behavior
  });

  it("skips a row with an ONS-suppressed ('x'-equivalent, i.e. missing) percentile", () => {
    const row = asheRow(
      "Some Suppressed Occupation",
      "9999",
      5,
      50000,
      10000,
      20000,
      0,
      90000,
    );
    row[14] = ""; // column 15 (p75, 0-indexed 14 after the helper's slice) — blank simulates ONS's "x" suppression
    const ws = buildAsheWorksheet([row]);
    const { points, skipReasons } = parseAsheWorksheet(ws, normalizer);
    expect(points).toHaveLength(0);
    expect(skipReasons["suppressed-or-missing-value"]).toBe(1);
  });

  it("skips a title that doesn't cross-match any O*NET occupation above the fuzzy threshold", () => {
    const ws = buildAsheWorksheet([
      asheRow(
        "Xyzzy Plugh Frotz Occupation",
        "8888",
        10,
        50000,
        10000,
        20000,
        70000,
        90000,
      ),
    ]);
    const { points, skipReasons } = parseAsheWorksheet(ws, normalizer);
    expect(points).toHaveLength(0);
    expect(skipReasons["no-cross-taxonomy-match"]).toBe(1);
  });
});
