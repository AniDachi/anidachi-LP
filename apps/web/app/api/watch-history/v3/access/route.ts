import { createAccountAccessHandlers } from "@/lib/anidachi-auth/watch-history-access";

export const dynamic = "force-dynamic";
export const GET = createAccountAccessHandlers().getAccess;
