import type { NextRequest } from "next/server";
import { handleWaitlistJoinPost } from "@/lib/kreatli-crm/waitlist-join-route";

export async function POST(request: NextRequest) {
  return handleWaitlistJoinPost(request);
}
