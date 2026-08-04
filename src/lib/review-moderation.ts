// Shared client/server moderation rules for review submissions.

export const MIN_PROS_CHARS = 75;
export const MIN_CONS_CHARS = 75;
export const MIN_COMBINED_CHARS = 150;

// Obvious profanity (kept short + intentional). Word-boundary based to avoid
// false positives like "class" / "assess".
const PROFANITY_PATTERNS: RegExp[] = [
  /\bf+u+c+k+\w*\b/i,
  /\bs+h+i+t+\w*\b/i,
  /\bb+i+t+c+h+\w*\b/i,
  /\bc+u+n+t+\w*\b/i,
  /\ba+s+s+h+o+l+e+\w*\b/i,
  /\bd+i+c+k+h+e+a+d+\w*\b/i,
  /\bb+a+s+t+a+r+d+\w*\b/i,
  /\bm+o+t+h+e+r+f+u+c+k+\w*\b/i,
  /\bw+h+o+r+e+\w*\b/i,
  /\br+e+t+a+r+d+\w*\b/i,
  /\bf+a+g+\w*\b/i,
  /\bn+i+g+\w*\b/i,
];

// Titles / role words that often appear when a reviewer is personally
// targeting someone. We flag them — the user can rephrase generically.
const TITLE_PATTERNS: RegExp[] = [
  /\b(ceo|cto|cfo|coo|chro|md|managing\s+director|founder|co[-\s]?founder)\b/i,
  /\b(manager|supervisor|team\s*lead|teamlead|boss|director|vp|vice\s+president|head\s+of\s+\w+)\b/i,
  /\b(mr\.?|mrs\.?|ms\.?|miss|sir|madam|ma['’]?am|dr\.?|prof\.?)\s+[A-Z][a-z]+/,
];

// Heuristic personal-name detector: two consecutive Capitalised words,
// where neither is a common sentence-start English word. Catches "John Smith"
// without firing on "I Joined" or "Great Place".
const COMMON_CAPITALISED = new Set([
  "I","The","A","An","My","We","They","He","She","It","This","That","These","Those",
  "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday",
  "January","February","March","April","May","June","July","August","September","October","November","December",
  "Pros","Cons","Work","Life","HR","IT","India","Bengaluru","Bangalore","Mumbai","Delhi","Pune","Chennai","Hyderabad","Noida","Gurgaon","Gurugram","Kolkata",
]);
const NAME_PATTERN = /\b([A-Z][a-z]{1,15})\s+([A-Z][a-z]{1,15})\b/g;

export type ModerationIssue =
  | { kind: "length"; field: "pros" | "cons" | "combined"; message: string }
  | { kind: "profanity"; field: "pros" | "cons"; message: string }
  | { kind: "title"; field: "pros" | "cons"; message: string }
  | { kind: "name"; field: "pros" | "cons"; message: string };

const hasProfanity = (text: string) => PROFANITY_PATTERNS.some((p) => p.test(text));
const hasTitleTarget = (text: string) => TITLE_PATTERNS.some((p) => p.test(text));

const hasPersonalName = (text: string) => {
  NAME_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NAME_PATTERN.exec(text)) !== null) {
    if (!COMMON_CAPITALISED.has(m[1]) && !COMMON_CAPITALISED.has(m[2])) return true;
  }
  return false;
};

export function moderateReview(input: { pros: string; cons: string }): ModerationIssue[] {
  const issues: ModerationIssue[] = [];
  const pros = input.pros.trim();
  const cons = input.cons.trim();

  if (pros.length < MIN_PROS_CHARS) {
    issues.push({
      kind: "length",
      field: "pros",
      message: `Pros must be at least ${MIN_PROS_CHARS} characters (currently ${pros.length}).`,
    });
  }
  if (cons.length < MIN_CONS_CHARS) {
    issues.push({
      kind: "length",
      field: "cons",
      message: `Cons must be at least ${MIN_CONS_CHARS} characters (currently ${cons.length}).`,
    });
  }
  if (pros.length + cons.length < MIN_COMBINED_CHARS) {
    issues.push({
      kind: "length",
      field: "combined",
      message: `Your review must be at least ${MIN_COMBINED_CHARS} characters in total.`,
    });
  }

  for (const [field, text] of [
    ["pros", pros],
    ["cons", cons],
  ] as const) {
    if (hasProfanity(text)) {
      issues.push({
        kind: "profanity",
        field,
        message: `Please remove profanity from your ${field}. Keep feedback professional.`,
      });
    }
    if (hasTitleTarget(text)) {
      issues.push({
        kind: "title",
        field,
        message: `Avoid naming or titling individuals (e.g. "Manager", "CEO", "Mr. Smith") in your ${field}. Describe behaviour, not people.`,
      });
    }
    if (hasPersonalName(text)) {
      issues.push({
        kind: "name",
        field,
        message: `Your ${field} appears to mention an individual by name. Please describe the situation without identifying anyone.`,
      });
    }
  }

  return issues;
}
