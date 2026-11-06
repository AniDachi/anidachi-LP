import { describe, expect, it } from "vitest";
import { ExtensionUninstallCapabilitySchema } from "./extension-uninstall";

describe("uninstall deployment capability", () => {
  it.each([true, false])("accepts explicit versioned availability %s", available => {
    expect(ExtensionUninstallCapabilitySchema.parse({ version: 1, available })).toEqual({ version: 1, available });
  });
  it.each([
    null, {}, { available: true }, { version: 2, available: true },
    { version: 1, available: "true" },
    { version: 1, available: true, url: "https://other.example" },
  ])("rejects unknown or ambiguous responses %j", value => {
    expect(ExtensionUninstallCapabilitySchema.safeParse(value).success).toBe(false);
  });
});
