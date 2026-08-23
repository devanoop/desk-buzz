import { describe, it, expect } from "vitest";
import { slugify } from "../slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Tata Digital")).toBe("tata-digital");
  });

  it("converts & to 'and'", () => {
    expect(slugify("Johnson & Johnson")).toBe("johnson-and-johnson");
  });

  it("strips special characters", () => {
    expect(slugify("Ola Electric!")).toBe("ola-electric");
  });

  it("collapses repeated separators", () => {
    expect(slugify("A   B---C")).toBe("a-b-c");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Acme-  ")).toBe("acme");
  });
});
