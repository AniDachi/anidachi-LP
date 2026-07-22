import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceAdaptersDirectory = resolve(process.cwd(), "src/source-adapters");
const providerDirectories = ["youtube", "crunchyroll", "generic"] as const;

describe("source adapter provider boundaries", () => {
  it("does not import a sibling provider folder", () => {
    for (const provider of providerDirectories) {
      const siblingDirectories = providerDirectories.filter((candidate) => candidate !== provider);
      const siblingImport = new RegExp(
        `from\\s+["']\\.\\./(?:${siblingDirectories.join("|")})/`,
      );
      const providerDirectory = resolve(sourceAdaptersDirectory, provider);

      for (const file of readdirSync(providerDirectory, { recursive: true })) {
        if (typeof file !== "string" || !file.endsWith(".ts")) {
          continue;
        }

        const source = readFileSync(resolve(providerDirectory, file), "utf8");
        expect(source, `${provider}/${file}`).not.toMatch(siblingImport);
      }
    }
  });
});
