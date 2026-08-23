import type { NextRequest } from "next/server";
import { handleContactPost } from "@/lib/kreatli-crm/contact-route";

export async function POST(request: NextRequest) {
  return handleContactPost(request);
}
