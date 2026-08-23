// One-off extraction script used to build data/samples/ons-ashe-sample.csv
// from the real ONS ASHE Table 14 (occupation by 4-digit SOC) file. Not part
// of the runtime pipeline (src/modules/ingestion/adapters/ons-ashe.ts parses
// the real file the same way at ingest time) — this is the reproducible
// recipe for how the committed sample was made.
//
// Usage:
//   curl -o /tmp/ashe14.zip "https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/occupation4digitsoc2010ashetable14/2025provisional/ashetable142025provisional.zip"
//   unzip -j /tmp/ashe14.zip "*Table 14.7a*Annual pay - Gross*.xlsx" -d /tmp/ashe_extract
//   node scripts/extract-ashe-sample.mjs "/tmp/ashe_extract/PROV - Occupation SOC20 (4) Table 14.7a   Annual pay - Gross 2025.xlsx" data/samples/ons-ashe-sample.csv
//
// Keeps only 4-digit SOC rows (the most granular unit-group level ONS
// publishes) with a usable, non-suppressed set of percentile figures. ONS
// marks unreliable estimates as "x" (CV > 20%) or discloses nothing at all —
// those rows are dropped rather than guessed at.

import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error(
    "Usage: node extract-ashe-sample.mjs <input.xlsx> <output.csv>",
  );
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(inputPath);
const ws = wb.getWorksheet("All");

const rows = [];
ws.eachRow((row, rowNumber) => {
  if (rowNumber < 6) return; // header/title rows
  const v = row.values;
  const description = v[1];
  const code = v[2];
  if (typeof code !== "string" || !/^\d{4}$/.test(code.trim())) return; // 4-digit SOC only

  const numJobsThousands = v[3];
  const median = v[4];
  const p10 = v[8];
  const p25 = v[10];
  const p75 = v[15];
  const p90 = v[17];

  const isUsable = (x) => typeof x === "number";
  if (![median, p10, p25, p75, p90, numJobsThousands].every(isUsable)) return; // drop "x"-suppressed rows

  rows.push({
    soc_code: code.trim(),
    title: String(description).trim(),
    sample_size_thousands: numJobsThousands,
    p10,
    p25,
    p50: median,
    p75,
    p90,
  });
});

const header = "soc_code,title,sample_size_thousands,p10,p25,p50,p75,p90";
const csvLines = rows.map((r) =>
  [
    r.soc_code,
    `"${r.title.replace(/"/g, '""')}"`,
    r.sample_size_thousands,
    r.p10,
    r.p25,
    r.p50,
    r.p75,
    r.p90,
  ].join(","),
);
writeFileSync(outputPath, [header, ...csvLines].join("\n") + "\n");
console.log(`Wrote ${rows.length} sample rows to ${outputPath}`);
