import { createCardlessTrialRecoveryHandler } from "@/lib/anidachi-auth/cardless-trial-routes";

export const runtime = "nodejs";
export const POST = createCardlessTrialRecoveryHandler();
