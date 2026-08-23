import type { NextRequest } from "next/server";
import { handleFeatureRequestPost } from "@/lib/kreatli-crm/feature-request-route";

export async function POST(request: NextRequest) {
  return handleFeatureRequestPost(request);
}
