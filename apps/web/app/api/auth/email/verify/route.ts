import { createEmailLoginRoutes } from "@/lib/anidachi-auth/email-login-routes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createEmailLoginRoutes().verify;
