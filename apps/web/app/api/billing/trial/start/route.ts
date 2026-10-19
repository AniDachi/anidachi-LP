import { createCardlessTrialStartHandler } from "@/lib/anidachi-auth/cardless-trial-routes";
export const POST = createCardlessTrialStartHandler();

// Operator recovery additionally verifies executor termination; a deadline alone is not proof.
export const maxDuration = 180;
