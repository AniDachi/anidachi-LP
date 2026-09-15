import { readContacts } from "@/lib/kreatli-crm/store";
import { countSurveyLeads } from "@/lib/kreatli-crm/survey-lead-shared";

const PRODUCTION_WAITLIST_STATS = "https://www.anidachi.app/api/waitlist-stats";

/**
 * Public social-proof count (CRM survey / signup leads).
 * Local file CRM is often empty; fall back to the live production count
 * unless we are on Vercel or inside an isolated CRM test (`CRM_DATA_DIR`).
 */
export async function getPublicSignupCount(): Promise<number> {
  const contacts = await readContacts();
  const count = countSurveyLeads(contacts);
  if (count > 0) return count;
  if (process.env.VERCEL === "1") return count;
  if (process.env.CRM_DATA_DIR) return count;
  return fetchProductionSignupCount();
}

async function fetchProductionSignupCount(): Promise<number> {
  try {
    const response = await fetch(PRODUCTION_WAITLIST_STATS, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!response.ok) return 0;
    const data = (await response.json()) as { count?: unknown };
    return typeof data.count === "number" && data.count > 0 ? data.count : 0;
  } catch {
    return 0;
  }
}
