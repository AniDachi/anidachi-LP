import fs from "fs/promises";
import path from "path";
import { crmDataDir } from "./store";

export async function listTemplateSlugs(): Promise<string[]> {
  const dir = path.join(crmDataDir(), "templates");
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
}
