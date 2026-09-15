import { NextResponse } from "next/server";
import {
  getExtensionArtifact,
  toPublicExtensionArtifact,
} from "@/lib/extension-artifact";

export const dynamic = "force-dynamic";

export async function GET() {
  const artifact = getExtensionArtifact();
  return NextResponse.json(toPublicExtensionArtifact(artifact));
}
