// One-off extraction script used to build data/samples/dol-lca-sample.csv from
// the real DOL OFLC LCA Disclosure Data file. Not part of the runtime
// ingestion pipeline (that lives in src/modules/ingestion/adapters/dol-lca.ts)
// — this is the reproducible recipe for how the committed sample was made,
// kept for transparency/auditability rather than run automatically.
//
// Usage:
//   curl -o /tmp/lca_full.xlsx https://www.dol.gov/media/LCA_Disclosure_Data_FY2026_Q3.xlsx
//   node scripts/extract-lca-sample.mjs /tmp/lca_full.xlsx data/samples/dol-lca-sample.csv
//
// Samples every Nth row across the full file (not just the first N), so the
// sample isn't clustered by submission date or employer. Keeps only rows
// with a "Certified" decision and a usable numeric wage — same filter the
// real adapter applies. Column positions are resolved by name from the
// actual header row, not hardcoded, since DOL has changed column order
// between fiscal years before.

import ExcelJS from "exceljs";
import { createWriteStream } from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node extract-lca-sample.mjs <input.xlsx> <output.csv>");
  process.exit(1);
}

const WANTED_COLUMNS = [
  "CASE_NUMBER",
  "CASE_STATUS",
  "SOC_CODE",
  "SOC_TITLE",
  "JOB_TITLE",
  "EMPLOYER_NAME",
  "WORKSITE_CITY",
  "WORKSITE_STATE",
  "FULL_TIME_POSITION",
  "WAGE_RATE_OF_PAY_FROM",
  "WAGE_RATE_OF_PAY_TO",
  "WAGE_UNIT_OF_PAY",
];

const KEEP_STATUSES = new Set(["Certified", "Certified - Withdrawn"]);
// ~41% of candidate rows pass the status+wage filter in practice, so
// candidate-sample more than the actual target to land near it after filtering.
const TARGET_ROWS = 7300;

function csvField(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const out = createWriteStream(outputPath);
out.write(WANTED_COLUMNS.join(",") + "\n");

const wb = new ExcelJS.stream.xlsx.WorkbookReader(inputPath, {});
let colIndex = null; // name -> 1-based column index, resolved from the header row
let dataRowIndex = 0;
let written = 0;
let totalDataRows = 0;

// First pass: count data rows so we know the sample stride.
for await (const worksheet of wb) {
  for await (const row of worksheet) {
    if (row.number === 1) continue;
    totalDataRows++;
  }
  break;
}

const stride = Math.max(1, Math.floor(totalDataRows / TARGET_ROWS));
console.log(
  `Total data rows: ${totalDataRows}, sampling every ${stride}th row`,
);

const wb2 = new ExcelJS.stream.xlsx.WorkbookReader(inputPath, {});
for await (const worksheet of wb2) {
  for await (const row of worksheet) {
    if (row.number === 1) {
      const headerValues = row.values;
      colIndex = {};
      for (const name of WANTED_COLUMNS) {
        const idx = headerValues.findIndex((h) => h === name);
        if (idx === -1) {
          console.error(
            `Column "${name}" not found in header — DOL changed the layout. Aborting.`,
          );
          process.exit(1);
        }
        colIndex[name] = idx;
      }
      continue;
    }
    dataRowIndex++;
    if (dataRowIndex % stride !== 0) continue;

    const v = row.values;
    const status = v[colIndex.CASE_STATUS];
    if (!KEEP_STATUSES.has(status)) continue;
    const wageFrom = v[colIndex.WAGE_RATE_OF_PAY_FROM];
    if (typeof wageFrom !== "number" || wageFrom <= 0) continue;

    out.write(
      WANTED_COLUMNS.map((name) => csvField(v[colIndex[name]])).join(",") +
        "\n",
    );
    written++;
  }
  break;
}

out.end(() => {
  console.log(`Wrote ${written} sample rows to ${outputPath}`);
});
