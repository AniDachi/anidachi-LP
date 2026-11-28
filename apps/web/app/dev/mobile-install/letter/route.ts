import { installLinkEmail } from "@/lib/install-link-email";

export function GET() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  return new Response(installLinkEmail().html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
