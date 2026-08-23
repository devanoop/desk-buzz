import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import type { OccupationRecord } from "./types";

interface OccupationDataRow {
  "O*NET-SOC Code": string;
  Title: string;
  Description: string;
}

interface ReportedTitleRow {
  "O*NET-SOC Code": string;
  Title: string;
  "Reported Job Title": string;
}

/**
 * Loads the O*NET 30.3 taxonomy (occupation_data.csv) and its reported/alias
 * titles (sample_of_reported_titles.csv) from the committed data files —
 * see docs/data-sources.md §4 for provenance. Both are required (CC BY 4.0)
 * to build a usable free-text-title -> SOC-code index.
 */
export function loadOnetOccupations(
  occupationDataPath: string,
  reportedTitlesPath: string,
): OccupationRecord[] {
  const occRows = parse(readFileSync(occupationDataPath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
  }) as OccupationDataRow[];

  const titleRows = parse(readFileSync(reportedTitlesPath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
  }) as ReportedTitleRow[];

  const aliasesByCode = new Map<string, Set<string>>();
  for (const row of titleRows) {
    const code = row["O*NET-SOC Code"];
    const alias = row["Reported Job Title"]?.trim();
    if (!code || !alias) continue;
    if (!aliasesByCode.has(code)) aliasesByCode.set(code, new Set());
    aliasesByCode.get(code)!.add(alias);
  }

  return occRows.map((row) => ({
    socCode: row["O*NET-SOC Code"],
    title: row.Title,
    description: row.Description || null,
    aliases: Array.from(aliasesByCode.get(row["O*NET-SOC Code"]) ?? []),
  }));
}

export type MatchType =
  | "soc-code"
  | "exact-title"
  | "alias"
  | "fuzzy"
  | "fuzzy-token";

export interface NormalizationMatch {
  socCode: string;
  title: string;
  matchType: MatchType;
  score: number; // 0..1, 1 = exact
}

const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

const similarity = (a: string, b: string) => {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 0 : 1 - levenshtein(a, b) / longest;
};

// Structural/connector words that carry no occupation-identifying signal on
// their own — stripped before token-overlap scoring so e.g. "and" or "of"
// can't contribute to a match.
const STOPWORDS = new Set([
  "and",
  "of",
  "the",
  "in",
  "for",
  "or",
  "other",
  "n",
  "e",
  "c",
  "occupations",
]);

// Crude prefix stemming (truncate to 7 chars) so "developer"/"development"/
// "developing" collapse to the same token for overlap purposes, without
// pulling in a real stemming library for what's a fairly narrow need.
const STEM_LENGTH = 7;
const tokenize = (normText: string): string[] =>
  normText
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .map((t) => t.slice(0, STEM_LENGTH));

/**
 * Overlap coefficient (|A∩B| / min(|A|,|B|)) over stemmed, stopword-filtered
 * tokens. Character-level edit distance (similarity(), above) is good for
 * typo-tolerance on the *same* title, but falls apart across two
 * independently-worded taxonomies — UK ASHE's "Programmers and software
 * development professionals" and O*NET's "Software Developers" share almost
 * no character-level structure despite being the same occupation. Token
 * overlap catches that; character similarity catches near-identical titles
 * with minor typos. The normalizer takes whichever scores higher.
 */
function tokenOverlapScore(
  aTokens: string[],
  bTokens: string[],
): { score: number; sharedCount: number; maxSharedLen: number } {
  const setB = new Set(bTokens);
  let sharedCount = 0;
  let maxSharedLen = 0;
  for (const t of new Set(aTokens)) {
    if (setB.has(t)) {
      sharedCount++;
      maxSharedLen = Math.max(maxSharedLen, t.length);
    }
  }
  const denom = Math.min(new Set(aTokens).size, setB.size);
  return {
    score: denom === 0 ? 0 : sharedCount / denom,
    sharedCount,
    maxSharedLen,
  };
}

/**
 * Maps free-text job titles (or already-known SOC codes) onto the O*NET
 * taxonomy. Deliberately conservative: below FUZZY_THRESHOLD it returns
 * null rather than guessing — an ingestion row that can't be confidently
 * normalized is skipped and counted, never inserted under a wrong or
 * fabricated occupation.
 */
export class OccupationNormalizer {
  private byCode = new Map<string, OccupationRecord>();
  private byExactTitle = new Map<string, OccupationRecord>();
  private byAlias = new Map<string, OccupationRecord>();
  private all: Array<{
    record: OccupationRecord;
    normTitle: string;
    tokens: string[];
  }>;
  // Real-world inputs (e.g. LCA job titles) repeat heavily; the fuzzy path
  // is an O(n) scan per call, so memoize by raw input to keep a full-file
  // ingest run from re-scanning identical titles thousands of times.
  private fuzzyCache = new Map<string, NormalizationMatch | null>();

  private static readonly FUZZY_THRESHOLD = 0.82;
  // Token overlap is a coarser signal than character similarity and, tuned
  // loosely, produces real false positives (e.g. "Social workers" vs.
  // "Social Scientists and Related Workers, All Other" — two shared words,
  // different occupations). Tuned conservatively here in favor of skipping
  // an ingestion row over mislabeling it; a real crosswalk table or
  // embeddings-based matcher would do meaningfully better and is a known
  // follow-up, not something this heuristic claims to solve — see
  // docs/data-sources.md.
  private static readonly TOKEN_OVERLAP_THRESHOLD = 0.75;
  private static readonly TOKEN_OVERLAP_MIN_SHARED_LEN = 6;
  private static readonly TOKEN_OVERLAP_MIN_SHARED_COUNT = 2;

  constructor(occupations: OccupationRecord[]) {
    for (const occ of occupations) {
      this.byCode.set(occ.socCode, occ);
      this.byExactTitle.set(normalizeText(occ.title), occ);
      for (const alias of occ.aliases) {
        const key = normalizeText(alias);
        // First occupation to claim an alias wins — O*NET aliases are
        // occasionally shared across closely related codes; ties aren't
        // worth resolving heuristically, so first-write is deterministic.
        if (!this.byAlias.has(key)) this.byAlias.set(key, occ);
      }
    }
    this.all = occupations.map((record) => {
      const normTitle = normalizeText(record.title);
      return { record, normTitle, tokens: tokenize(normTitle) };
    });
  }

  /** Resolve a SOC code the source already provided (still validated against the taxonomy). */
  bySocCode(code: string): NormalizationMatch | null {
    const occ = this.byCode.get(code);
    if (!occ) return null;
    return {
      socCode: occ.socCode,
      title: occ.title,
      matchType: "soc-code",
      score: 1,
    };
  }

  normalize(freeText: string): NormalizationMatch | null {
    const norm = normalizeText(freeText);
    if (!norm) return null;

    const exact = this.byExactTitle.get(norm);
    if (exact)
      return {
        socCode: exact.socCode,
        title: exact.title,
        matchType: "exact-title",
        score: 1,
      };

    const alias = this.byAlias.get(norm);
    if (alias)
      return {
        socCode: alias.socCode,
        title: alias.title,
        matchType: "alias",
        score: 1,
      };

    if (this.fuzzyCache.has(norm)) return this.fuzzyCache.get(norm)!;

    const queryTokens = tokenize(norm);
    let bestChar: { record: OccupationRecord; score: number } | null = null;
    let bestToken: {
      record: OccupationRecord;
      score: number;
      maxSharedLen: number;
      sharedCount: number;
    } | null = null;

    for (const { record, normTitle, tokens } of this.all) {
      const charScore = similarity(norm, normTitle);
      if (!bestChar || charScore > bestChar.score)
        bestChar = { record, score: charScore };

      const {
        score: tokenScore,
        maxSharedLen,
        sharedCount,
      } = tokenOverlapScore(queryTokens, tokens);
      if (!bestToken || tokenScore > bestToken.score)
        bestToken = { record, score: tokenScore, maxSharedLen, sharedCount };
    }

    let result: NormalizationMatch | null = null;
    if (bestChar && bestChar.score >= OccupationNormalizer.FUZZY_THRESHOLD) {
      result = {
        socCode: bestChar.record.socCode,
        title: bestChar.record.title,
        matchType: "fuzzy",
        score: bestChar.score,
      };
    } else if (
      bestToken &&
      bestToken.score >= OccupationNormalizer.TOKEN_OVERLAP_THRESHOLD &&
      bestToken.maxSharedLen >=
        OccupationNormalizer.TOKEN_OVERLAP_MIN_SHARED_LEN &&
      bestToken.sharedCount >=
        OccupationNormalizer.TOKEN_OVERLAP_MIN_SHARED_COUNT
    ) {
      result = {
        socCode: bestToken.record.socCode,
        title: bestToken.record.title,
        matchType: "fuzzy-token",
        score: bestToken.score,
      };
    }

    this.fuzzyCache.set(norm, result);
    return result;
  }
}
