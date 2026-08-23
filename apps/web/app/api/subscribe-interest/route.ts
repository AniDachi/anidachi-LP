import type { NextRequest } from "next/server";
import { handleSubscribeInterestPost } from "@/lib/kreatli-crm/subscribe-interest-route";

export async function POST(request: NextRequest) {
  return handleSubscribeInterestPost(request);
}
