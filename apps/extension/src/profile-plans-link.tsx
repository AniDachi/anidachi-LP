import { ArrowUpRight } from "lucide-react";
import { WEB_HTTP_BASE } from "./constants";

export function ProfilePlansLink() {
  return (
    <a
      className="panel-plan-link"
      href={new URL("/pricing", WEB_HTTP_BASE).href}
      target="_blank"
      rel="noopener noreferrer"
    >
      View plans<ArrowUpRight size={11} aria-hidden="true" />
    </a>
  );
}
