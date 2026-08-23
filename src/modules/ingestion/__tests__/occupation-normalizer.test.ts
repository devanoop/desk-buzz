import { describe, it, expect, beforeAll } from "vitest";
import {
  loadOnetOccupations,
  OccupationNormalizer,
} from "../occupation-normalizer";

// Uses the real committed O*NET taxonomy files (data/onet/) rather than a
// synthetic fixture — it's the same data the app ships with, so a test
// against it is also a sanity check that the committed files parse cleanly.
describe("OccupationNormalizer", () => {
  let normalizer: OccupationNormalizer;

  beforeAll(() => {
    const records = loadOnetOccupations(
      "data/onet/occupation_data.csv",
      "data/onet/sample_of_reported_titles.csv",
    );
    expect(records.length).toBeGreaterThan(1000); // sanity: real file, not a stub
    normalizer = new OccupationNormalizer(records);
  });

  it("resolves an exact known SOC code", () => {
    const match = normalizer.bySocCode("15-1252.00");
    expect(match).not.toBeNull();
    expect(match!.title).toBe("Software Developers");
    expect(match!.matchType).toBe("soc-code");
    expect(match!.score).toBe(1);
  });

  it("returns null for an unknown SOC code", () => {
    expect(normalizer.bySocCode("99-9999.99")).toBeNull();
  });

  it("resolves an exact canonical title, case-insensitively", () => {
    const match = normalizer.normalize("software developers");
    expect(match?.socCode).toBe("15-1252.00");
    expect(match?.matchType).toBe("exact-title");
  });

  it("resolves a real O*NET reported alias title", () => {
    // "CEO (Chief Executive Officer)" is a real alias for 11-1011.00 in the
    // committed sample_of_reported_titles.csv.
    const match = normalizer.normalize("CEO (Chief Executive Officer)");
    expect(match?.socCode).toBe("11-1011.00");
    expect(match?.matchType).toBe("alias");
  });

  it("fuzzy-matches a close misspelling above the threshold", () => {
    const match = normalizer.normalize("Softwar Developer"); // one dropped letter, one dropped plural
    expect(match?.socCode).toBe("15-1252.00");
    expect(match?.matchType).toBe("fuzzy");
  });

  it("does not fabricate a match for an unrelated or nonsense title", () => {
    expect(normalizer.normalize("Xyzzy Plugh Frotz")).toBeNull();
    expect(normalizer.normalize("")).toBeNull();
  });

  it("token-overlap matches a differently-worded but same-occupation title (cross-taxonomy case)", () => {
    // Real UK ASHE title vs. its real O*NET counterpart — character-level
    // similarity is low here (different word order/structure), but the two
    // titles share substantive tokens once stopwords are stripped.
    const match = normalizer.normalize(
      "Programmers and software development professionals",
    );
    expect(match?.socCode).toBe("15-1252.00");
    expect(match?.matchType).toBe("fuzzy-token");
  });

  it("does not token-overlap-match on a single generic shared word", () => {
    // "IT managers" shares only "manager(s)" with plenty of unrelated
    // titles — the min-shared-token-count guard should block a false match.
    const match = normalizer.normalize(
      "Regional widget logistics coordinator manager",
    );
    expect(match).toBeNull();
  });

  it("does not confuse two genuinely different occupations", () => {
    // Regression guard: "Software Developers" vs "Software Quality Assurance
    // Analysts and Testers" are different codes and shouldn't fuzzy-collide.
    const match = normalizer.normalize(
      "Software Quality Assurance Analysts and Testers",
    );
    expect(match?.socCode).toBe("15-1253.00");
  });
});
