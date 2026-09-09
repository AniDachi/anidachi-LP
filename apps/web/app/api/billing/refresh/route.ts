import { createBillingHandlers } from "@/lib/anidachi-auth/billing-routes";

export const dynamic = "force-dynamic";
export const POST = createBillingHandlers().refresh;
