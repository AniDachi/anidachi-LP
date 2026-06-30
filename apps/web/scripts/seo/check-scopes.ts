import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGoogleAdsOAuth2 } from "../../lib/google-ads/oauth";
import { readGoogleAdsTokens } from "../../lib/google-ads/tokens";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  for (const rel of ["../../.env.local", "../../../.env.local"]) {
    const envPath = path.join(__dirname, rel);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i > 0 && process.env[t.slice(0, i)] === undefined) {
        process.env[t.slice(0, i)] = t.slice(i + 1);
      }
    }
  }
}

async function main() {
  loadEnvLocal();
  const tokens = await readGoogleAdsTokens();
  console.log("token source:", process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local");
  console.log("has refresh:", Boolean(tokens?.refresh_token));
  console.log("email:", tokens?.email ?? "(none)");

  const oauth2 = createGoogleAdsOAuth2("http://localhost");
  if (!oauth2 || !tokens?.refresh_token) throw new Error("No oauth/token");
  oauth2.setCredentials({ refresh_token: tokens.refresh_token });
  const { credentials } = await oauth2.refreshAccessToken();
  const info = (await fetch(
    `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${credentials.access_token}`
  ).then((r) => r.json())) as { scope?: string; error?: string };
  console.log("scopes:\n", (info.scope ?? info.error ?? info).toString().replace(/ /g, "\n "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
