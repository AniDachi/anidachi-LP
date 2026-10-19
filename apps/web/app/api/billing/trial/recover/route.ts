import { createCardlessTrialRecoveryHandler } from "@/lib/anidachi-auth/cardless-trial-routes";

export const runtime = "nodejs";
export const POST = createCardlessTrialRecoveryHandler();

// Operator recovery additionally verifies executor termination; a deadline alone is not proof.
export const maxDuration = 180;
