// One-off script used to build data/samples/bls-oews-sample.csv from BLS's
// public Time Series API (api.bls.gov), which is reachable even in
// environments where bls.gov's main site (and its bulk oesm{YY}all.zip
// files) is blocked by bot protection. Not part of the runtime ingestion
// pipeline (src/modules/ingestion/adapters/bls-oews.ts parses the real bulk
// file) — this is the reproducible recipe for the committed sample.
//
// Usage: node scripts/fetch-bls-sample.mjs
//
// Series ID format (confirmed against live API responses, not guessed):
//   OEUN + area(7, "0000000"=national) + industry(6, "000000"=cross-industry)
//     + SOC code without dash (6 digits) + datatype(2)
// Datatype codes used: 11=annual p10, 12=annual p25, 13=annual median,
// 14=annual p75, 15=annual p90.

import { writeFileSync } from "node:fs";

// Real O*NET-SOC codes, cross-checked against data/onet/occupation_data.csv,
// chosen for relevance to this product's audience (tech/product/business
// roles) — not an exhaustive occupation list, just this sample's scope.
const OCCUPATIONS = [
  ["11-1021", "General and Operations Managers"],
  ["11-2021", "Marketing Managers"],
  ["11-2022", "Sales Managers"],
  ["11-3021", "Computer and Information Systems Managers"],
  ["11-3121", "Human Resources Managers"],
  ["13-1111", "Management Analysts"],
  ["13-2011", "Accountants and Auditors"],
  ["15-1211", "Computer Systems Analysts"],
  ["15-1212", "Information Security Analysts"],
  ["15-1231", "Computer Network Support Specialists"],
  ["15-1232", "Computer User Support Specialists"],
  ["15-1241", "Computer Network Architects"],
  ["15-1242", "Database Administrators"],
  ["15-1244", "Network and Computer Systems Administrators"],
  ["15-1251", "Computer Programmers"],
  ["15-1252", "Software Developers"],
  ["15-1253", "Software Quality Assurance Analysts and Testers"],
  ["15-1254", "Web Developers"],
  ["15-1255", "Web and Digital Interface Designers"],
  ["15-1299", "Computer Occupations, All Other"],
  ["15-2051", "Data Scientists"],
  ["27-1024", "Graphic Designers"],
  ["43-4051", "Customer Service Representatives"],
];

const DATATYPES = { p10: "11", p25: "12", p50: "13", p75: "14", p90: "15" };

function seriesId(socCode, datatype) {
  const soc6 = socCode.replace("-", "");
  return `OEUN0000000000000${soc6}${datatype}`;
}

// Build a map back from seriesID -> {socCode, title, percentile}
const seriesMeta = new Map();
const allSeriesIds = [];
for (const [soc, title] of OCCUPATIONS) {
  for (const [pct, code] of Object.entries(DATATYPES)) {
    const id = seriesId(soc, code);
    seriesMeta.set(id, { soc, title, pct });
    allSeriesIds.push(id);
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const results = new Map(); // seriesID -> { year, value }

for (const batch of chunk(allSeriesIds, 25)) {
  const res = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesid: batch }),
  });
  const json = await res.json();
  if (json.status !== "REQUEST_SUCCEEDED") {
    console.error("BLS API request failed:", json.status, json.message);
    process.exit(1);
  }
  for (const series of json.Results.series) {
    const latest =
      series.data.find((d) => d.latest === "true") ?? series.data[0];
    if (latest)
      results.set(series.seriesID, { year: latest.year, value: latest.value });
  }
  console.log(
    `Fetched batch of ${batch.length} series (${results.size} total so far)`,
  );
}

// Reshape into one row per (occupation) with p10..p90 columns.
const rows = [];
for (const [soc, title] of OCCUPATIONS) {
  const row = { soc_code: soc, occupation_title: title, year: null };
  let ok = true;
  for (const pct of Object.keys(DATATYPES)) {
    const id = seriesId(soc, DATATYPES[pct]);
    const r = results.get(id);
    if (!r || r.value === "-") {
      ok = false;
      break;
    }
    row[pct] = r.value;
    row.year = r.year;
  }
  if (ok) rows.push(row);
  else console.warn(`Skipping ${soc} (${title}) — incomplete data`);
}

const header = "soc_code,occupation_title,year,p10,p25,p50,p75,p90";
const csvLines = rows.map((r) =>
  [
    r.soc_code,
    `"${r.occupation_title}"`,
    r.year,
    r.p10,
    r.p25,
    r.p50,
    r.p75,
    r.p90,
  ].join(","),
);
writeFileSync(
  "data/samples/bls-oews-sample.csv",
  [header, ...csvLines].join("\n") + "\n",
);
console.log(`Wrote ${rows.length} rows to data/samples/bls-oews-sample.csv`);
