import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import { createUninstallFeedbackGet } from "@/lib/kreatli-crm/uninstall-feedback-route";
import { readUninstallFeedback } from "@/lib/kreatli-crm/uninstall-feedback-store";

export const dynamic = "force-dynamic";
export const GET = createUninstallFeedbackGet({ authorized: verifyKreatliCrmSession, read: readUninstallFeedback });
