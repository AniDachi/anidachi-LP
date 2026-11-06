import { z } from "zod";

// Deployment capability only: never grants a discount or changes account access.
export const EXTENSION_UNINSTALL_CAPABILITY_PATH = "/api/extension/uninstall-capability";
export const ExtensionUninstallCapabilitySchema = z.object({
  version: z.literal(1),
  available: z.boolean(),
}).strict();
export type ExtensionUninstallCapability = z.infer<typeof ExtensionUninstallCapabilitySchema>;
