import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  parseDolLcaFile,
  processLcaRow,
  resolveLcaColumnIndex,
} from "../../adapters/dol-lca";

// Header order/content matches the real FY2026 Q3 file's column names
// (confirmed live this session, see docs/data-sources.md §2) — the parser
// resolves columns by name, so a subset of the real 99 columns is enough
// to exercise it.
const HEADER = [
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
];
const COL = resolveLcaColumnIndex(HEADER);

// processLcaRow is the pure per-row logic (annualization, status filtering,
// column resolution) and is unit-tested directly here — deterministic, no
// file I/O. The one exception is the last test below, which goes through
// the real streaming file reader end-to-end.
describe("processLcaRow", () => {
  it("parses a real-shaped certified row into an annualized USD observation", () => {
    // Real row from data/samples/dol-lca-sample.csv (annual wage unit).
    const row = [
      "Certified",
      "15-1252.00",
      "Software Developers",
      "Software Engineer",
      "FIONA SOLUTIONS INC",
      "Pineville",
      "NC",
      91500,
      null,
      "Year",
    ];
    const result = processLcaRow(COL, row);
    expect("observation" in result).toBe(true);
    if ("observation" in result) {
      expect(result.observation).toMatchObject({
        occupationSocCodeHint: "15-1252.00",
        employerName: "FIONA SOLUTIONS INC",
        country: "US",
        region: "NC",
        city: "Pineville",
        payAnnual: 91500,
        payCurrency: "USD",
      });
    }
  });

  it("annualizes hourly wages using the documented 2080hr/year convention", () => {
    const row = [
      "Certified",
      "15-1253.00",
      "Software QA",
      "QA Engineer",
      "Acme",
      "Austin",
      "TX",
      65,
      85,
      "Hour",
    ];
    const result = processLcaRow(COL, row);
    // midpoint of 65-85 = 75/hr * 2080 = 156000
    expect("observation" in result && result.observation.payAnnual).toBe(
      156_000,
    );
  });

  it("annualizes monthly and weekly wages correctly", () => {
    const monthly = processLcaRow(COL, [
      "Certified",
      "15-1252.00",
      "SD",
      "Dev",
      "Acme",
      "Austin",
      "TX",
      8000,
      null,
      "Month",
    ]);
    const weekly = processLcaRow(COL, [
      "Certified",
      "15-1252.00",
      "SD",
      "Dev",
      "Acme",
      "Austin",
      "TX",
      2000,
      null,
      "Week",
    ]);
    expect("observation" in monthly && monthly.observation.payAnnual).toBe(
      96_000,
    ); // 8000 * 12
    expect("observation" in weekly && weekly.observation.payAnnual).toBe(
      104_000,
    ); // 2000 * 52
  });

  it("uses the midpoint of a posted wage range when WAGE_RATE_OF_PAY_TO is given", () => {
    const result = processLcaRow(COL, [
      "Certified",
      "15-1252.00",
      "SD",
      "Dev",
      "Acme",
      "Austin",
      "TX",
      100_000,
      120_000,
      "Year",
    ]);
    expect("observation" in result && result.observation.payAnnual).toBe(
      110_000,
    );
  });

  it("drops rows that are not Certified", () => {
    const denied = processLcaRow(COL, [
      "Denied",
      "15-1252.00",
      "SD",
      "Dev",
      "Acme",
      "Austin",
      "TX",
      100000,
      null,
      "Year",
    ]);
    const withdrawn = processLcaRow(COL, [
      "Withdrawn",
      "15-1252.00",
      "SD",
      "Dev",
      "Acme",
      "Austin",
      "TX",
      100000,
      null,
      "Year",
    ]);
    expect(denied).toEqual({ skipReason: "not-certified" });
    expect(withdrawn).toEqual({ skipReason: "not-certified" });
  });

  it("drops rows with a missing or zero wage rather than fabricating one", () => {
    const missing = processLcaRow(COL, [
      "Certified",
      "15-1252.00",
      "SD",
      "Dev",
      "Acme",
      "Austin",
      "TX",
      null,
      null,
      "Year",
    ]);
    const zero = processLcaRow(COL, [
      "Certified",
      "15-1252.00",
      "SD",
      "Dev",
      "Acme",
      "Austin",
      "TX",
      0,
      null,
      "Year",
    ]);
    expect(missing).toEqual({ skipReason: "missing-wage" });
    expect(zero).toEqual({ skipReason: "missing-wage" });
  });

  it("drops rows with an unrecognized wage unit rather than guessing an annualization", () => {
    const result = processLcaRow(COL, [
      "Certified",
      "15-1252.00",
      "SD",
      "Dev",
      "Acme",
      "Austin",
      "TX",
      100,
      null,
      "Fortnight",
    ]);
    expect(result).toEqual({ skipReason: "unrecognized-wage-unit:Fortnight" });
  });

  it("falls back to SOC_TITLE when JOB_TITLE is blank, and skips if both are blank", () => {
    const fallback = processLcaRow(COL, [
      "Certified",
      "15-1252.00",
      "Software Developers",
      "",
      "Acme",
      "Austin",
      "TX",
      100000,
      null,
      "Year",
    ]);
    expect(
      "observation" in fallback && fallback.observation.occupationTitleRaw,
    ).toBe("Software Developers");

    const bothBlank = processLcaRow(COL, [
      "Certified",
      "15-1252.00",
      "",
      "",
      "Acme",
      "Austin",
      "TX",
      100000,
      null,
      "Year",
    ]);
    expect(bothBlank).toEqual({ skipReason: "missing-job-title" });
  });
});

describe("resolveLcaColumnIndex", () => {
  it("throws if a required column is missing (source reshaped)", () => {
    expect(() => resolveLcaColumnIndex(["CASE_STATUS", "SOC_CODE"])).toThrow(
      /expected column/,
    );
  });
});

// One true end-to-end test through the real streaming file reader, proving
// parseDolLcaFile's file-handling (header detection, iteration, aggregation
// of skip reasons) works against an actual xlsx on disk — not just the pure
// row logic above.
describe("parseDolLcaFile (end-to-end)", () => {
  let tmpDir: string;
  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  // exceljs's streaming WorkbookReader has a known intermittent failure
  // ("Cannot read properties of undefined (reading 'sheets')") when reading
  // a workbook immediately after writing it in the same process — confirmed
  // by running this exact test repeatedly with no code changes. Not a
  // real-pipeline concern (production always reads a file fetched over HTTP
  // in a separate run, never one just written locally), and processLcaRow's
  // own tests above are fully deterministic — this retry exists only to
  // keep end-to-end file-reading coverage without a flaky CI signal.
  it(
    "reads a real xlsx file end-to-end and aggregates parsed/skipped counts",
    { retry: 3 },
    async () => {
      tmpDir = mkdtempSync(join(tmpdir(), "dol-lca-test-"));
      const path = join(tmpDir, "fixture.xlsx");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("LCA_Disclosure_Data");
      ws.addRow(HEADER);
      ws.addRow([
        "Certified",
        "15-1252.00",
        "Software Developers",
        "Software Engineer",
        "FIONA SOLUTIONS INC",
        "Pineville",
        "NC",
        91500,
        null,
        "Year",
      ]);
      ws.addRow([
        "Denied",
        "15-1252.00",
        "Software Developers",
        "Software Engineer",
        "Acme",
        "Austin",
        "TX",
        100000,
        null,
        "Year",
      ]);
      await wb.xlsx.writeFile(path);

      const { observations, rowsParsed, rowsSkipped, skipReasons } =
        await parseDolLcaFile(path);
      expect(rowsParsed).toBe(2);
      expect(observations).toHaveLength(1);
      expect(rowsSkipped).toBe(1);
      expect(skipReasons["not-certified"]).toBe(1);
    },
  );
});
