import { createUninstallHandlers } from "@/lib/anidachi-auth/uninstall-routes";

export const POST = createUninstallHandlers().claim;
