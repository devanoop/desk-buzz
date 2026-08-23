import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import { parseOewsWorksheet } from "../../adapters/bls-oews";
import {
  loadOnetOccupations,
  OccupationNormalizer,
} from "../../occupation-normalizer";

const HEADERS = [
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
];

function buildWorksheet(rows: (string | number)[][]): ExcelJS.Worksheet {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(HEADERS);
  for (const row of rows) ws.addRow(row);
  return ws;
}

describe("parseOewsWorksheet", () => {
  let normalizer: OccupationNormalizer;

  beforeAll(() => {
    const records = loadOnetOccupations(
      "data/onet/occupation_data.csv",
      "data/onet/sample_of_reported_titles.csv",
    );
    normalizer = new OccupationNormalizer(records);
  });

  it("parses a real-shaped national row into 5 percentile points", () => {
    const ws = buildWorksheet([
      [
        "U.S.",
        "1",
        "15-1252",
        "Software Developers",
        1_800_000,
        82460,
        105210,
        135980,
        171980,
        214670,
      ],
    ]);
    const { points, rowsParsed, rowsSkipped } = parseOewsWorksheet(
      ws,
      normalizer,
    );
    expect(rowsParsed).toBe(1);
    expect(rowsSkipped).toBe(0);
    expect(points).toHaveLength(5);
    expect(points.every((p) => p.occupationSocCode === "15-1252.00")).toBe(
      true,
    );
    expect(
      points.every((p) => p.country === "US" && p.payCurrency === "USD"),
    ).toBe(true);
    const median = points.find((p) => p.percentile === "p50")!;
    expect(median.payAmount).toBe(135980);
    expect(median.confidence).toBe("high"); // TOT_EMP well above the high-confidence threshold
  });

  it("skips non-national (state/MSA) rows", () => {
    const ws = buildWorksheet([
      [
        "California",
        "2",
        "15-1252",
        "Software Developers",
        400_000,
        90000,
        110000,
        140000,
        175000,
        220000,
      ],
    ]);
    const { points, rowsSkipped, skipReasons } = parseOewsWorksheet(
      ws,
      normalizer,
    );
    expect(points).toHaveLength(0);
    expect(rowsSkipped).toBe(1);
    expect(skipReasons["not-national-row"]).toBe(1);
  });

  it("skips rows with a suppressed wage figure ('*') rather than fabricating a number", () => {
    const ws = buildWorksheet([
      [
        "U.S.",
        "1",
        "15-1252",
        "Software Developers",
        50,
        "*",
        "*",
        "*",
        "*",
        "*",
      ],
    ]);
    const { points, skipReasons } = parseOewsWorksheet(ws, normalizer);
    expect(points).toHaveLength(0);
    expect(skipReasons["suppressed-or-missing-wage"]).toBe(1);
  });

  it("skips a row whose occupation code isn't in the taxonomy rather than inventing one", () => {
    const ws = buildWorksheet([
      ["U.S.", "1", "99-9999", "Not A Real Occupation", 100, 1, 2, 3, 4, 5],
    ]);
    const { points, skipReasons } = parseOewsWorksheet(ws, normalizer);
    expect(points).toHaveLength(0);
    expect(skipReasons["occupation-not-in-taxonomy"]).toBe(1);
  });

  it("throws if a required column is missing (source reshaped)", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["AREA_TITLE", "AREA_TYPE", "OCC_CODE"]); // missing OCC_TITLE, TOT_EMP, percentiles
    ws.addRow(["U.S.", "1", "15-1252"]);
    expect(() => parseOewsWorksheet(ws, normalizer)).toThrow(/expected column/);
  });
});
